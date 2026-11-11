-- The database's fence on `attempts.status` (AD-5), for every role, plus the
-- time the current grading was requested and the claim that restarts a
-- grading stuck in `received` (U4).
--
-- Until now only the TS state machine (`src/core/services/attempts/
-- lifecycle.ts`) and the session's RLS policy kept writes to `status` on the
-- AD-5 diagram: the service role and the superuser could write any
-- transition. The fence below refuses, for every role (`authenticated`,
-- `service_role`, superuser), an insert in any status but `open` and an
-- UPDATE that changes `status` along anything but the 8 edges of the diagram
-- (the same edges as `transition()`). An UPDATE that leaves `status` as it
-- is passes. Refusal: SQLSTATE 23514, constraint `attempts_status_ad5`.
--
-- A BEFORE trigger fires before RLS `with check`: a session update outside
-- the diagram (`open → graded`) is now refused by the fence (23514) before
-- the policy (42501); a session update along an edge the policy does not
-- allow (`open → received`) is still 42501.
--
-- `graded → closed` is outside AD-5, so the allowance of migration
-- 20261109000001 ("`result` stays when a graded attempt later moves to
-- closed", `attempts_result_only_when_graded` accepting `closed`) is now
-- unreachable. The constraint is left as it is.

-- (1) When the current grading was requested: stamped by the database
-- (`now()`) each time the attempt moves to `received` (the first file, and
-- every Try again), never sent by the app. `received_at` stays the time of
-- the first file (AD-8: duration and records); this column tells how long the
-- current grading has run (the slow message after a reload, and U4's 15 s).
alter table public.attempts
  add column grading_requested_at timestamptz;

-- Rows already waiting or failed: their grading was requested when the file
-- arrived. `graded` rows are not touched: `attempts_graded_has_result` is
-- `not valid`, and Postgres re-checks it on any UPDATE of a legacy `graded`
-- row without a result (2.12).
update public.attempts
  set grading_requested_at = received_at
  where status in ('received', 'grading_failed');

-- The session reads it (migration 20261104000001: a new column is not
-- readable until granted); the service role reads it through its table-level
-- `select`. No one is granted update: only the trigger below and
-- `claim_grading_restart` (security definer) write it.
grant select (grading_requested_at) on public.attempts to authenticated;

-- (2) The same trigger as before (`attempts_stamp_received_at`, before update
-- of status), now also stamping `grading_requested_at`. `received_at`
-- behaves as before.
create or replace function public.attempts_stamp_received_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'open' and new.status = 'received' then
    new.received_at := now();
  else
    new.received_at := old.received_at;
  end if;

  if new.status = 'received' and old.status in ('open', 'grading_failed') then
    new.grading_requested_at := now();
  else
    new.grading_requested_at := old.grading_requested_at;
  end if;
  return new;
end;
$$;

revoke execute on function public.attempts_stamp_received_at() from public, anon, authenticated;

-- (3) The fence. The 8 edges must equal `transition()` in
-- `src/core/services/attempts/lifecycle.ts`.
create or replace function public.attempts_status_fence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'open' then
      raise exception 'attempts.status must be open on insert, not %', new.status
        using errcode = 'check_violation', constraint = 'attempts_status_ad5';
    end if;
    return new;
  end if;

  if new.status is distinct from old.status and (old.status, new.status) not in (
    ('open', 'received'), ('open', 'abandoned'), ('open', 'closed'), ('received', 'graded'),
    ('received', 'grading_failed'), ('received', 'abandoned'), ('grading_failed', 'abandoned'),
    ('grading_failed', 'received')
  ) then
    raise exception 'attempts.status % -> % is not an AD-5 transition', old.status, new.status
      using errcode = 'check_violation', constraint = 'attempts_status_ad5';
  end if;
  return new;
end;
$$;

revoke execute on function public.attempts_status_fence() from public, anon, authenticated;

create trigger attempts_status_fence_insert
  before insert on public.attempts
  for each row
  execute function public.attempts_status_fence();

create trigger attempts_status_fence_update
  before update of status on public.attempts
  for each row
  execute function public.attempts_status_fence();

-- (4) U4: a grading stuck in `received` (`after()` stopped, Storage or the
-- database faulted) is restarted by the status endpoint, at most once per
-- 15 s per attempt. The claim is one atomic UPDATE (the database's clock,
-- not the app server's): the caller that moves `grading_requested_at` to
-- `now()` wins and schedules the grading; a concurrent or later caller within
-- 15 s matches no row. The result is still written once, by the grader's
-- compare-and-set on `status = 'received'`.
create or replace function public.claim_grading_restart(p_attempt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.attempts
    set grading_requested_at = now()
    where id = p_attempt_id
      and status = 'received'
      and coalesce(grading_requested_at, received_at) <= now() - interval '15 seconds';
  return found;
end;
$$;

revoke execute on function public.claim_grading_restart(uuid) from public, anon, authenticated;
grant execute on function public.claim_grading_restart(uuid) to service_role;

update public.app_meta
  set value = '20261110000001', updated_at = now()
  where key = 'schema_version';
