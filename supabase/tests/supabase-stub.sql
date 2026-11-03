-- The slice of a Supabase database that `supabase/migrations` relies on, for
-- the contract tests (`contract.db.test.ts`) on a plain Postgres 16. Not a
-- full Supabase: no Auth or Storage servers, no PostgREST, no extensions.
-- Run as a superuser on an empty database, before every migration, in order.

-- API roles (cluster-wide, so created only when missing). `service_role`
-- bypasses RLS, as on Supabase; `anon` and `authenticated` do not.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin noinherit;
  end if;
end;
$$;

-- Auth: the users table the profiles reference, and `auth.uid()` read from
-- the JWT claims PostgREST sets per request (`request.jwt.claims` ->> 'sub').
create schema auth;

create table auth.users (
  id uuid primary key,
  email text
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub', '')::uuid;
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Storage: buckets, objects (RLS on, as on Supabase) and `storage.foldername`.
create schema storage;

create table storage.buckets (
  id text primary key,
  name text not null unique,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now()
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  unique (bucket_id, name)
);

alter table storage.objects enable row level security;

-- `storage.foldername('a/b/c.xlsm')` = `{a,b}`, as Supabase defines it.
create or replace function storage.foldername(name text)
returns text[]
language plpgsql
immutable
as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end;
$$;

grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;

-- Supabase's defaults on `public`: every API role may use the schema and gets
-- every privilege on what the migration role creates there. The migrations'
-- `revoke all` statements are tested against these.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
