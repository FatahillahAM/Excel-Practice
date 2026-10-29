-- Google sign-in with a one-account allowlist (CAP-17, AD-9) and the user's
-- profile with the streak time zone (AD-8).
--
-- The allowlist lives in a private schema that the Data API does not expose
-- and only Supabase Auth (`supabase_auth_admin`) can read. It ships empty: the
-- one allowed email is inserted directly on `dev` and `prod`, never in the repo.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;

create table private.auth_allowlist (
  email text primary key check (email = lower(btrim(email)) and email <> ''),
  created_at timestamptz not null default now()
);

alter table private.auth_allowlist enable row level security;
revoke all on private.auth_allowlist from public, anon, authenticated;
grant select on private.auth_allowlist to supabase_auth_admin;

create policy "auth_allowlist is readable by supabase auth"
  on private.auth_allowlist for select
  to supabase_auth_admin
  using (true);

-- Before User Created hook (Authentication > Hooks): lets a new user through
-- only when the email is on the allowlist (case-insensitive). The rejection
-- message carries `not_allowlisted`, which the app's auth callback maps to the
-- Login "account not allowlisted" message.
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  candidate text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if candidate <> '' and exists (
    select 1 from private.auth_allowlist a where a.email = candidate
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'not_allowlisted: this account is not allowed to sign up'
    )
  );
end;
$$;

grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;

-- One row per user, written once at first sign-in from the browser's IANA
-- time zone; there is no update grant, so `time_zone` never changes.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- The app sends the browser's zone after checking it against ICU; Postgres
  -- must know it too (an unknown zone makes `at time zone` raise, rejecting
  -- the insert).
  time_zone text not null check (
    char_length(time_zone) between 1 and 64
    and ('2000-01-01 00:00:00+00'::timestamptz at time zone time_zone) is not null
  ),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select, insert on public.profiles to authenticated;

create policy "profiles are readable by their owner"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles are created by their owner"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

update public.app_meta
  set value = '20261029000003', updated_at = now()
  where key = 'schema_version';
