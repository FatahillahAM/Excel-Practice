-- App metadata (AD-13): one row per key. `schema_version` names the latest
-- migration, so /health can show which schema an environment runs. Every
-- later migration updates it to its own version.
create table public.app_meta (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_meta enable row level security;

-- /health reads it server-side with the publishable key; nothing in it is private.
create policy "app_meta is readable by anyone"
  on public.app_meta for select
  to anon, authenticated
  using (true);

grant select on public.app_meta to anon, authenticated;

insert into public.app_meta (key, value) values ('schema_version', '20261029000001');
