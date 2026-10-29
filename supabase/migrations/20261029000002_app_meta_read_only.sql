-- app_meta is read-only for API roles. Supabase's default privileges on
-- `public` grant anon and authenticated every table privilege; RLS already
-- blocks writes, but the grants should say read-only too.
revoke all on public.app_meta from anon, authenticated;
grant select on public.app_meta to anon, authenticated;

update public.app_meta
  set value = '20261029000002', updated_at = now()
  where key = 'schema_version';
