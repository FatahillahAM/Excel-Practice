-- The stored Result of a graded attempt (AD-3): `attempts.result`, a JSON
-- object (`resultSchema` in `src/core/grading/result.ts`) with the score,
-- per-question points, Indonesian reasons and Tips. It never holds the answer
-- key or expected values, so the owner may read it through their session
-- (Results, History: AD-9); only the service role writes it (the grading path
-- in `after()`), in the same compare-and-set that moves the attempt from
-- `received` to `graded` (AD-5). No separate `results` table: the Result id is
-- the attempt id.
--
-- `result` exists only on a `graded` attempt. Every new `graded` row must
-- carry one; the check is `not valid` so the rows graded by SQL during the
-- 2.12 tracer (no result) stay legal (Results answers 404 for them).

alter table public.attempts
  add column result jsonb
    check (result is null or jsonb_typeof(result) = 'object');

alter table public.attempts
  add constraint attempts_result_only_when_graded
    check (result is null or status = 'graded');

alter table public.attempts
  add constraint attempts_graded_has_result
    check (status <> 'graded' or result is not null) not valid;

-- Column-level select for the session (migration 20261104000001: a new column
-- is not readable until granted). No insert or update for the session.
grant select (result) on public.attempts to authenticated;

-- The service role reads it through its table-level `select`; it writes it
-- with `status` in one UPDATE.
grant update (result) on public.attempts to service_role;

-- Set once: `result` goes from null to a value and never changes again (not
-- even by the service role), so Results and History always show what grading
-- first wrote.
create or replace function public.attempts_result_set_once()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.result is not null and new.result is distinct from old.result then
    raise exception 'attempts.result is set once and cannot change'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke execute on function public.attempts_result_set_once() from public, anon, authenticated;

create trigger attempts_result_set_once
  before update of result on public.attempts
  for each row
  execute function public.attempts_result_set_once();

update public.app_meta
  set value = '20261109000001', updated_at = now()
  where key = 'schema_version';
