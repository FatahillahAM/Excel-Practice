# Supabase migrations

Schema changes happen only through SQL files in `migrations/` (AD-13): never through the dashboard. They are applied to `dev` (`excel-practice-dev`, `krfkxropldheqhbqtkfo`) first, then to `prod` (`excel-practice-prod`, `njkftlwsfpggrciyrwim`).

## Writing a migration

1. Name it `<YYYYMMDDHHMMSS>_<snake_case>.sql` with a version later than every existing file.
2. End it by setting the schema version to its own version, so `/health` shows it:

   ```sql
   update public.app_meta
     set value = '<version>', updated_at = now()
     where key = 'schema_version';
   ```

   `src/adapters/supabase/migrations.test.ts` fails if a file does not mention its own version and `schema_version`.
3. Every new table: RLS on, owner-only policies, no grants beyond what the policies need (AD-9).

## Applying it

- **Supabase CLI** (2.121.x, from a machine that reaches `*.supabase.co`): `supabase link --project-ref <ref>` then `supabase db push`, for `dev` and then `prod`.
- **Supabase MCP** (agent sessions, which cannot reach the database directly): `apply_migration` with the file's SQL and its snake_case name, on `dev` and then `prod`. `apply_migration` records its own timestamp as the version, so on each project rename it to the file's version afterwards:

  ```sql
  update supabase_migrations.schema_migrations
    set version = '<file version>'
    where version = '<recorded version>' and name = '<name>';
  ```

Afterwards `list_migrations` (MCP) or `supabase migration list` must show the same versions on both projects as the files here, and `/health` on Preview (`dev`) and Production (`prod`) shows the newest version.
