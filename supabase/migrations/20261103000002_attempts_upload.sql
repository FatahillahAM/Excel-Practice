-- Upload (AD-6, CAP-4): the owner submits through their session (AD-9), so
-- the upload path needs what the macro path does with the service role:
-- move their own `open` attempt to `received`, and store
-- `attempt-files/<attemptId>/submission-1.xlsm` (replacing an earlier,
-- never-accepted file) while it is `open`. `core/submission` decides; this is
-- the database's second fence. No `security definer` function: RLS stays in
-- force.

-- `open` → `received` by the owner. `received_at` stays the trigger's
-- (`attempts_stamp_received_at` stamps it on exactly this move).
create policy "open attempts are received by their owner"
  on public.attempts for update
  to authenticated
  using (
    (select auth.uid()) = user_id
    and status = 'open'
  )
  with check (
    (select auth.uid()) = user_id
    and status = 'received'
  );

-- Permissive policies are OR-ed: with Abandon's policy
-- (`open|received|grading_failed` → `abandoned`), a `grading_failed` row would
-- pass Abandon's `using` and this policy's `with check`, letting the owner
-- move it back to `received` (Try again is grading's, epic 3). The guard
-- checks the pair itself: for `authenticated`, only `open → received` and
-- `open|received|grading_failed → abandoned`; anything else is 42501, like an
-- RLS refusal. Other roles (the service role, migrations) are not limited here.
create or replace function public.attempts_guard_owner_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
     and not (
       (old.status = 'open' and new.status = 'received')
       or (old.status in ('open', 'received', 'grading_failed') and new.status = 'abandoned')
     ) then
    raise exception 'attempt status % -> % is not allowed for the owner', old.status, new.status
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke execute on function public.attempts_guard_owner_transition() from public, anon, authenticated;

create trigger attempts_guard_owner_transition
  before update on public.attempts
  for each row
  execute function public.attempts_guard_owner_transition();

-- Storage: the owner writes `<attemptId>/submission-1.xlsm` while the attempt
-- is `open`. Upload upserts (insert, or update of the existing object), so
-- both are allowed on that one name and nothing else; the existing select
-- policy covers the read an upsert needs.
create policy "submitted files are uploaded by the open attempt's owner"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'attempt-files'
    and exists (
      select 1 from public.attempts a
      where name = a.id::text || '/submission-1.xlsm'
        and a.user_id = (select auth.uid())
        and a.status = 'open'
    )
  );

create policy "submitted files are replaced by the open attempt's owner"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'attempt-files'
    and exists (
      select 1 from public.attempts a
      where name = a.id::text || '/submission-1.xlsm'
        and a.user_id = (select auth.uid())
        and a.status = 'open'
    )
  )
  with check (
    bucket_id = 'attempt-files'
    and exists (
      select 1 from public.attempts a
      where name = a.id::text || '/submission-1.xlsm'
        and a.user_id = (select auth.uid())
        and a.status = 'open'
    )
  );

update public.app_meta
  set value = '20261103000002', updated_at = now()
  where key = 'schema_version';
