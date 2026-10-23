# Review — research verification

Verdict: PASS with 2 notes. Versions checked against npm registry on 2026-10-23 (next 16.4.2, react 19.3.1, tailwindcss 4.3.3, shadcn 4.22.1, supabase-js 2.118.0, @supabase/ssr 0.12.7, supabase CLI 2.121.0, jszip 3.10.2, fast-xml-parser 5.11.2, zod 4.6.7, vitest 5.0.5). Web: Next.js `after()` stable since 15.1 (waitUntil on Vercel); Vercel Node 24.x default LTS, Node 20 deprecated 2026-10-01; Vercel Python Services exists (fallback); CSS scroll-driven animations not in Firefox (fallback mandated by AD-12); Supabase starter `with-supabase`; Auth.js security-only.

| # | Finding | Severity | Disposition |
|---|---|---|---|
| V1 | Supabase "Before User Created" hook coverage of Google OAuth sign-ups not confirmed (supabase.com unreachable from the container) | medium | Keep: AD-9 already re-checks `ALLOWED_EMAIL` in the auth callback; verify the hook in the first auth story |
| V2 | SheetJS current version unverifiable (npm `xlsx` 0.18.5 is stale; docs.sheetjs.com unreachable) | low | Already Deferred to spike S2; not pinned in Stack |
| V3 | Node pin should be major-only (Vercel staff guidance) | low | Autofix: Stack row "24.x (major only)" |
