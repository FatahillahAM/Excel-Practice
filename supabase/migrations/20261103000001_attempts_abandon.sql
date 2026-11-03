-- Abandon (AD-5): the owner moves their own attempt in progress (`open`,
-- `received`, `grading_failed`) to `abandoned`, through their session (AD-9),
-- and to nothing else. `core/services/attempts` decides the transition; this
-- grant and policy are the database's second fence. No `security definer`
-- function: RLS stays in force.
--
-- `using` checks the row as it is (owner, one of the three statuses);
-- `with check` checks the row as it becomes (owner, `abandoned` only). Only
-- `status` is updatable; `received_at` stays the trigger's
-- (`attempts_stamp_received_at` keeps the old value on every other change).

grant update (status) on public.attempts to authenticated;

create policy "attempts in progress are abandoned by their owner"
  on public.attempts for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and status in ('open', 'received', 'grading_failed')
  )
  with check (
    (select auth.uid()) = user_id
    and status = 'abandoned'
  );

update public.app_meta
  set value = '20261103000001', updated_at = now()
  where key = 'schema_version';
