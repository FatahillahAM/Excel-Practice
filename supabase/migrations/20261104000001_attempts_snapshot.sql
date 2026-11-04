-- The exam snapshot of an attempt (AD-3): content version, scenario id, seed
-- and the questions with points, checks and answer key, written by Start's
-- insert through the user's session. Attempts made before this migration
-- (the tracer) keep `snapshot` null and are never graded.
--
-- The key must stay out of the session's reach (AD-9): the session may insert
-- `snapshot` but neither read nor update it. `authenticated` had a table-level
-- `select`, which would cover the new column, so it becomes a column-level
-- grant on every other column. Only the service role (grading, epic 3) reads
-- the snapshot; its table-level `select` already covers it.

alter table public.attempts
  add column snapshot jsonb
    check (snapshot is null or jsonb_typeof(snapshot) = 'object');

revoke select on public.attempts from authenticated;
grant select (id, user_id, item_id, token_sha256, template_version, status, started_at, received_at)
  on public.attempts to authenticated;
grant insert (snapshot) on public.attempts to authenticated;

update public.app_meta
  set value = '20261104000001', updated_at = now()
  where key = 'schema_version';
