-- The exam snapshot of an attempt (AD-3): content version, scenario id, seed
-- and the questions with points, checks and answer key. Attempts made before
-- this migration (the tracer) keep `snapshot` null and are never graded.
--
-- The key must stay out of the session's reach, for reading and for writing
-- (AD-9): a session that could write it could insert its own row with any
-- key and checks, and the grader would trust them. So `authenticated` gets
-- no privilege on `snapshot` at all. Start creates the row through the
-- session (without a snapshot), then writes the snapshot with the service
-- role, `where id = ? and user_id = <session user> and snapshot is null`.
-- Only the service role reads it (grading, epic 3; its table-level `select`
-- covers the column).
--
-- `authenticated` had a table-level `select`, which would have covered the
-- new column, so it becomes a column-level grant on every other column.
-- NOTE: from here on, a new column of `attempts` is not readable by the
-- session until a migration grants it explicitly.

alter table public.attempts
  add column snapshot jsonb
    check (snapshot is null or jsonb_typeof(snapshot) = 'object');

revoke select on public.attempts from authenticated;
grant select (id, user_id, item_id, token_sha256, template_version, status, started_at, received_at)
  on public.attempts to authenticated;

grant update (snapshot) on public.attempts to service_role;

-- Set once: `snapshot` goes from null to a value, and never changes again
-- (not even by the service role), so an attempt is graded against what Start
-- generated.
create or replace function public.attempts_snapshot_set_once()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.snapshot is not null and new.snapshot is distinct from old.snapshot then
    raise exception 'attempts.snapshot is set once and cannot change'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.attempts_snapshot_set_once() from public, anon, authenticated;

create trigger attempts_snapshot_set_once
  before update of snapshot on public.attempts
  for each row
  execute function public.attempts_snapshot_set_once();

update public.app_meta
  set value = '20261104000001', updated_at = now()
  where key = 'schema_version';
