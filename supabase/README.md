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

## Auth (Google)

Only one Google account gets a session (CAP-17, AD-9). Two gates, both required:

1. **Before User Created hook** `public.hook_before_user_created` (migration `20261029000003`) rejects every new user whose email is not in `private.auth_allowlist`. The table ships empty; the one allowed email is inserted directly on each project (MCP `execute_sql` or the SQL editor), never in the repo:

   ```sql
   insert into private.auth_allowlist (email) values (lower('<allowed email>'));
   ```

2. **`ALLOWED_EMAIL`** (Vercel env for Production, Preview and Development; `.env.local` for local dev) is re-checked in `/auth/callback`; any other account is signed out again.

The app's flow: `/login` opens `/auth/google` in a popup → Google → Supabase (`/auth/v1/callback`) → `/auth/callback` exchanges the code (PKCE, `@supabase/ssr` cookies), creates `profiles` (with the browser's time zone) on first sign-in, reports to the Login page and closes. `POST /auth/signout` is Log out.

### Dashboard setup (once per project)

**Google Cloud Console** (APIs & Services):

1. OAuth consent screen: External, app name, the user's email as support and developer contact; scopes `openid`, `email`, `profile`. While the app is in *Testing*, add the allowed account as a test user (or publish it; the basic scopes need no verification).
2. Credentials → Create credentials → OAuth client ID → *Web application*. Authorized redirect URIs, one per Supabase project:
   - `https://krfkxropldheqhbqtkfo.supabase.co/auth/v1/callback` (`dev`)
   - `https://njkftlwsfpggrciyrwim.supabase.co/auth/v1/callback` (`prod`)

   Keep the client secret out of the repo and out of Vercel; it goes only into Supabase.

**Supabase dashboard**, on `dev` and on `prod`:

1. Authentication → Sign In / Providers → **Google**: enabled, client ID and secret from above.
2. Authentication → Sign In / Providers → **Allow new users to sign up**: on (the hook is the gate; with sign-up off even the allowed account cannot be created). Email/password and other providers stay off.
3. Authentication → URL Configuration:
   - `prod`: Site URL `https://excel-practice-omega.vercel.app`; Redirect URLs `https://excel-practice-omega.vercel.app/auth/callback**`.
   - `dev`: Site URL `http://localhost:3000`; Redirect URLs `http://localhost:3000/auth/callback**` and `https://excel-practice-*-fatahillahams-projects.vercel.app/auth/callback**` (Preview).
4. Authentication → Hooks → **Before User Created** → Postgres function `public.hook_before_user_created`.
5. Sessions: leave *Time-box user sessions* and *Inactivity timeout* unset, so the refresh token keeps the session for ~30 days and longer per device.

### Checking it

- The allowed account signs in from Login and `public.profiles` gets one row with its time zone.
- Another Google account sees "Akun ini nggak terdaftar…" and `auth.users` gets no row for it.
- After Log out, `/` redirects to `/login`; `POST /api/submissions/macro` still answers without a session.
