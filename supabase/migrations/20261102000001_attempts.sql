-- Attempts (AD-5) and the private bucket for their files (AD-9, Storage paths).
--
-- One row per Start. The row holds the SHA-256 of the attempt token (the file
-- carries the token itself), never the token. `started_at` and `received_at`
-- are set by the database (AD-8). At most one attempt per user is in progress
-- (`open`, `received`, `grading_failed`): a partial unique index, so a second
-- Start is refused by the database itself.

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- `L01-P1` … `L09-T`, `UA` (Consistency Conventions › Naming).
  item_id text not null check (item_id ~ '^L\d{2}-(P[1-5]|T)$|^UA$'),
  -- Lowercase hex SHA-256 of `WHE_AttemptToken`: the macro path finds the attempt by it.
  token_sha256 text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
  -- The template version `generate()` returned with the file (AD-4).
  template_version integer not null check (template_version > 0),
  status text not null default 'open'
    check (status in ('open', 'received', 'graded', 'grading_failed', 'abandoned', 'closed')),
  started_at timestamptz not null default now(),
  -- Set by the trigger below when the attempt leaves `open` for `received`.
  received_at timestamptz,
  check (status not in ('received', 'graded', 'grading_failed') or received_at is not null)
);

create unique index attempts_one_in_progress_idx
  on public.attempts (user_id)
  where status in ('open', 'received', 'grading_failed');

create index attempts_user_started_idx on public.attempts (user_id, started_at desc);

-- `received_at` is the database's time of the first accepted file (AD-8),
-- never a value a client sends.
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
  return new;
end;
$$;

revoke execute on function public.attempts_stamp_received_at() from public, anon, authenticated;

create trigger attempts_stamp_received_at
  before update of status on public.attempts
  for each row
  execute function public.attempts_stamp_received_at();

alter table public.attempts enable row level security;

-- Supabase's default privileges on `public` grant every API role every table
-- privilege: take them all back, then grant only what each path needs.
revoke all on public.attempts from anon, authenticated, service_role;
-- The user's session: read own rows; Start inserts only these three columns
-- (`user_id`, `status` and `started_at` come from their defaults); Start's
-- compensation deletes its own row while it is still `open`.
grant select on public.attempts to authenticated;
grant insert (item_id, token_sha256, template_version) on public.attempts to authenticated;
grant delete on public.attempts to authenticated;
-- The macro path (service role, AD-9): find the attempt by hash, then move it
-- from `open` to `received` (compare-and-set in the statement).
grant select on public.attempts to service_role;
grant update (status) on public.attempts to service_role;

create policy "attempts are readable by their owner"
  on public.attempts for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "attempts are created by their owner"
  on public.attempts for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "open attempts are deleted by their owner"
  on public.attempts for delete
  to authenticated
  using ((select auth.uid()) = user_id and status = 'open');

-- Generated and submitted files: `attempt-files/<attemptId>/…`. Private; the
-- browser never reaches it (AD-9): the app streams the bytes through the
-- user's session.
insert into storage.buckets (id, name, public)
  values ('attempt-files', 'attempt-files', false)
  on conflict (id) do nothing;

create policy "attempt files are uploaded by the attempt's owner"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'attempt-files'
    and exists (
      select 1 from public.attempts a
      where a.id::text = (storage.foldername(name))[1]
        and a.user_id = (select auth.uid())
    )
  );

create policy "attempt files are readable by the attempt's owner"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'attempt-files'
    and exists (
      select 1 from public.attempts a
      where a.id::text = (storage.foldername(name))[1]
        and a.user_id = (select auth.uid())
    )
  );

update public.app_meta
  set value = '20261102000001', updated_at = now()
  where key = 'schema_version';
