---
title: 'Sign in with Google dengan allowlist satu akun'
type: 'feature'
ticket: '7'
created: '2026-10-29'
status: done
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: '423fbb833fdf0dda87a3631ff847cb219052146c'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md'
  - '{project-root}/supabase/README.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Semua halaman masih publik dan belum ada login. CAP-17 menuntut hanya satu akun Google user yang mendapat sesi (±30 hari per perangkat), akun lain ditolak tanpa sesi, tanpa pendaftaran dan password; AD-8 butuh `profiles.time_zone` dari browser saat login pertama.

**Approach:** Login Google lewat Supabase Auth (PKCE, server-side) dengan popup sesuai Login Card: halaman `/login`, route `/auth/google` (memulai OAuth) dan `/auth/callback` (tukar kode, cek ulang `ALLOWED_EMAIL`, buat `profiles` dengan zona waktu browser, kabari jendela pembuka lalu tutup). Migrasi baru: allowlist privat + fungsi hook Before User Created + tabel `profiles` (RLS owner-only). `proxy.ts` mengalihkan request tanpa sesi ke `/login?next=…`, kecuali route publik. Log out mengakhiri sesi ke Login.

**Decisions (user, 2026-10-29):**
- Akun yang diizinkan: satu akun Gmail milik user, dipilih user 2026-10-29; nilainya hanya ada di Vercel env `ALLOWED_EMAIL` dan baris allowlist di dev dan prod, tidak di repo.
- Email disimpan di tabel privat (`private.auth_allowlist`, kosong di migrasi), diisi langsung di `dev` dan `prod` lewat MCP; tidak ada email di repo.
- Sign-up Supabase dinyalakan lagi di `dev` dan `prod`; hook Before User Created menolak setiap email selain allowlist, dan callback mengecek ulang `ALLOWED_EMAIL`.
- Plan dipertahankan utuh walau di atas 1600 token.

## Boundaries & Constraints

**Always:** browser tidak memanggil tabel Supabase; OAuth dan sesi lewat `@supabase/ssr` di server (AD-9); `next` hanya path relatif (`/…`, bukan `//`), selain itu `/`; `profiles.time_zone` IANA yang valid, ditulis sekali (tidak ada update); route publik: `/login`, `/auth/*`, `/api/submissions/macro`, `/health`, aset statis; API lain tanpa sesi → 401 JSON envelope; pesan error Login persis dari EXPERIENCE.md (Indonesian), chrome Inggris; tidak ada form email/password.

**Never:** secret Google atau service-role di repo atau browser; email di repo; mengubah route macro; app shell/sidebar (entry 8).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Akun diizinkan, pertama kali | akun Google = `ALLOWED_EMAIL` | sesi dibuat, `profiles` (id, time_zone) dibuat, pembuka ke `next` | — |
| Akun diizinkan, berikutnya | sudah ada `profiles` | sesi, `time_zone` tidak berubah | — |
| Akun lain | email lain | hook menolak (tanpa user/sesi); inline "Akun ini nggak terdaftar…" | callback cek ulang: sign out bila lolos |
| Popup diblokir | `window.open` null | inline "Pop-up login diblokir browser…" | — |
| Popup ditutup | user menutup popup | kembali idle, tanpa error | — |
| Gagal jaringan/server | error OAuth lain | inline "Koneksi lagi bermasalah…" | — |
| Sudah login | buka `/login` | redirect ke `next` atau `/` | — |
| Tanpa sesi | halaman terlindungi | redirect `/login?next=<path>` | API → 401 JSON |
| Macro tanpa sesi | `POST /api/submissions/macro` | tetap diproses seperti sebelumnya | — |
| `next` jahat | `next=//evil.com` atau URL absolut | diganti `/` | — |
| Log out | aksi Log out | sesi berakhir → `/login` | — |

</frozen-after-approval>

## Code Map

- `src/adapters/supabase/server.ts` -- `createClient()` dengan cookie store Next; dipakai route handler dan Server Component.
- `src/adapters/supabase/proxy.ts` -- `updateSession`: refresh sesi via `getClaims()`; komentar menunggu entry 7 untuk proteksi route. `src/proxy.ts` matcher semua path kecuali aset.
- `src/app/page.tsx` -- halaman placeholder; tempat tombol Log out sementara (app shell di entry 8).
- `src/app/globals.css` -- token Dark Excel (`--background`, `--card`, `--primary`, `--destructive`, `--muted-foreground`).
- `_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/imports/login-page.zip` dan DESIGN.md › Components › Login Card -- tata letak Login (kolom `max-w-md`, logo 32px, judul, subjudul, tombol "Sign in with Google" dengan logo G, slot error inline `role="alert"`).
- `supabase/migrations/` -- versi terakhir `20261029000002`; README menjelaskan konvensi (`schema_version`, RLS, terapkan dev lalu prod lewat MCP + rename versi).
- Supabase hook Postgres: fungsi `(event jsonb) returns jsonb`, `{}` untuk lolos, `{"error":{"http_code":403,"message":…}}` untuk menolak; `grant execute … to supabase_auth_admin`, revoke dari `anon, authenticated, public` (docs Before User Created Hook; berjalan juga untuk sign-up OAuth).
- Project: `prod` `njkftlwsfpggrciyrwim`, `dev` `krfkxropldheqhbqtkfo`; Production `https://excel-practice-omega.vercel.app`; Preview `https://excel-practice-*-fatahillahams-projects.vercel.app`.

## Tasks & Acceptance

**Execution (agent):**
- [x] `supabase/migrations/20261029000003_auth_profiles.sql` -- schema `private` + `private.auth_allowlist(email)` (hanya `supabase_auth_admin` boleh baca), `public.hook_before_user_created(event jsonb)` (cocokkan email case-insensitive), `public.profiles(id → auth.users, time_zone, created_at)` RLS owner-only select/insert, `schema_version`.
- [x] `src/adapters/supabase/auth.ts` + `profiles.ts` -- mulai OAuth Google, tukar kode, cek `ALLOWED_EMAIL`, sign out, buat profil sekali.
- [x] `src/app/login/` -- halaman + Login Card (client) dengan popup, `postMessage` same-origin, status idle/loading/error/cancel.
- [x] `src/app/auth/google/route.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/signout/route.ts` (POST).
- [x] `src/adapters/supabase/proxy.ts` -- proteksi route + redirect `/login?next=`; 401 untuk API.
- [x] `src/app/page.tsx` -- tombol Log out sementara.
- [x] Tes Vitest untuk fungsi murni: `safeNext`, cocok allowlist, pemetaan hasil callback, klasifikasi path publik.
- [x] `supabase/README.md` -- bagian "Auth (Google)": langkah dashboard Google Cloud dan Supabase.
- [ ] Terapkan migrasi ke `dev` lalu `prod`; isi `private.auth_allowlist` di keduanya; Vercel env `ALLOWED_EMAIL` (production, preview, development).

**Execution (user, dashboard):** OAuth client Google (redirect URI kedua project `…/auth/v1/callback`); di tiap project Supabase: provider Google on (client ID/secret), sign-up on, URL Configuration (Site URL + Redirect URLs `/auth/callback**`), hook Before User Created → `public.hook_before_user_created`.

**Acceptance Criteria:**
- Given Production, when akun `ALLOWED_EMAIL` login, then masuk ke Dashboard/`/` dan `profiles.time_zone` terisi.
- Given akun Google lain, when login, then pesan inline tanpa sesi dan tanpa baris di `auth.users`.
- Given sesi aktif, when Log out lalu buka `/`, then dialihkan ke `/login`; `POST /api/submissions/macro` tetap diterima tanpa sesi.

## Implementation Notes

- Fungsi murni ada di `src/adapters/supabase/auth-rules.ts` (`safeNext`, `isAllowedEmail`, `classifyOAuthError`, `normalizeTimeZone`, `callbackFallbackUrl`, `callbackPageHtml`, `isPublicPath`, `isApiPath`, `loginRedirectPath`), dites di `auth-rules.test.ts`; pesan Login Indonesia di `src/messages/id.ts`.
- Penolakan hook membawa penanda `not_allowlisted` di `message`; Supabase meneruskannya sebagai `error_description` ke `/auth/callback`, yang memetakannya ke "Akun ini nggak terdaftar…". `access_denied` tanpa penanda = batal (idle, tanpa error).
- Proxy gagal-tertutup: tanpa env Supabase, semua path non-publik dialihkan ke `/login` (API → 401 `UNAUTHENTICATED`).
- Log out dan penolakan di callback memakai `signOut({ scope: "local" })`: hanya sesi perangkat ini yang berakhir.
- `time_zone` disimpan seperti yang dilaporkan browser setelah divalidasi ICU (ICU sendiri menormalkan ke nama link lama, mis. `Asia/Calcutta`); bila tidak valid, profil tidak dibuat dan dicoba lagi pada login berikutnya. Kolom juga dicek di DB (`at time zone` harus dikenal Postgres).
- Migrasi `20261029000003_auth_profiles` diterapkan ke `dev` lalu `prod` lewat MCP dan versinya di-rename; advisor keamanan bersih di keduanya. `private.auth_allowlist` masih kosong dan Vercel `ALLOWED_EMAIL` belum dibuat: nilai email pilihan user tidak ada di plan.

- Allowlist: one row inserted into `private.auth_allowlist` on `dev` and `prod` via MCP (value not in the repo); Vercel env `ALLOWED_EMAIL` (encrypted) for production, preview and development.
- User did the dashboard steps (Google OAuth client, provider, sign-up on, URL Configuration, Before User Created hook on both projects). First Preview attempt failed with `Unsupported provider: missing OAuth secret` (secret not saved in `dev`); after the user saved it, sign-in on Preview (commit 21e3809) worked: `dev` has 1 `auth.users` row (provider `google`) and 1 `profiles` row with `time_zone = Asia/Jakarta`, same id.
- A provider misconfiguration shows Supabase's raw JSON in the popup (rejected on Supabase's authorize page, before the callback); config-only failure, left as is.

- Review patches (commit 6b061db): top-level-only static paths, `access_denied` with `error_code` → error, zone rejected by Postgres → `skipped`, distinct log for unset `ALLOWED_EMAIL`, try/catch in `/auth/google` and `/auth/callback`, popup-closed reload of `/login`, link fallback before hydration, `?error=` removed after reading; new tests for proxy, `completeGoogleSignIn`, `ensureProfile`, the three `/auth/*` routes and the `?error=` round trip (288 tests). User re-tested Preview (deploy `dpl_GuUEjRgTqx2WkJaNrnMburA2nY5V`) on 2026-10-30: sign-in, Log out → `/login`, and the other-account check all as expected.

- Production (PR #5 merged 2026-10-30, `/health` commit `f1b9a05`): first sign-in failed with `signup_disabled` because sign-up was still off on `prod` from entry 1; after the user turned it on (hook already enabled), sign-in worked. `prod` has 1 `auth.users` row (provider google) and 1 `profiles` row (`Asia/Jakarta`, same id); `/health` OK with schema `20261029000003`; `GET /api/submissions/macro` without a session reaches the route (405), not the guard.

## Plan Change Log

## Review Triage Log

| # | Lens | Finding | Verdict | Evidence | Route |
|---|------|---------|---------|----------|-------|
| 1 | blind-hunter, edge-case-hunter, verification-gap | `isPublicPath` treats a static-looking extension at any depth as public (`/levels/03.js`) | medium | `STATIC_FILE` is tested against any non-API path; the comment says top of `public/` only; a later dynamic page route would skip the guard | patch: single path segment only + tests |
| 2 | blind-hunter, edge-case-hunter | A zone known to ICU but not to Postgres tzdata fails the CHECK and signs the allowed user out on every login | low | Insert error 23514 maps to `failed` → sign out + network message; rare (zone renames) but a lockout | patch: treat a check violation as `skipped` and log it |
| 3 | blind-hunter, edge-case-hunter | No valid zone → signed in without `profiles` for the whole session | low | Nothing reads `profiles` yet; AD-8 consumers (streaks, epic 3) are where a missing row matters | defer |
| 4 | edge-case-hunter | `access_denied` with an `error_code` (e.g. `signup_disabled`) is shown as a cancel | low | `classifyOAuthError` maps any `access_denied` without the marker to `cancelled` | patch: cancel only when there is no `error_code` |
| 5 | blind-hunter, edge-case-hunter | If Google's COOP cuts `window.opener`, the app loads in the popup and Login treats the close as a cancel | low | Poll sees `closed` with no message → idle, though a session exists | patch: when the popup closes without a message, reload `/login` (the proxy redirects a signed-in visitor to `next`) |
| 6 | blind-hunter, edge-case-hunter | `/auth/google` and `/auth/callback` throw into Next's error page, no `postMessage` | low | No try/catch around `createClient`, Supabase calls, `ensureProfile` | patch: catch and return the error page / `callbackPageHtml("error")` |
| 7 | blind-hunter | Unset `ALLOWED_EMAIL` looks like a stranger's account in the logs | low | Same `auth.not_allowed` event | patch: distinct log event |
| 8 | edge-case-hunter | Transient `getClaims` error sends a signed-in user to Login | low | Fails closed during an Auth outage; signing in again recovers | reject (fail-closed is the safer side) |
| 9 | edge-case-hunter | Opener navigated to another origin drops the result | low | Requires leaving the app mid-login; result is a closed popup and idle Login | reject |
| 10 | blind-hunter | Button does nothing before hydration or without JS | low | Fallback renders a `<button>` with no handler; tab flow already exists | patch: render a link to `/auth/google` that JS turns into the popup |
| 11 | blind-hunter | `?error=` stays in the URL and reappears after a retry or reload | low | `errorFromParam` reads it once; never removed | patch: remove it with `history.replaceState` |
| 12 | verification-gap, blind-hunter | Proxy guard untested beyond pure helpers | low | Pre-verified: `updateSession` never runs in a test | patch: `proxy.test.ts` (no-env branch, signed-in branch with mocked client) |
| 13 | verification-gap, blind-hunter | `completeGoogleSignIn` second gate untested | low | Pre-verified | patch: `auth.test.ts` with fake client |
| 14 | verification-gap, blind-hunter | `ensureProfile` branches untested | low | Pre-verified | patch: `profiles.test.ts` |
| 15 | verification-gap | `/auth/callback` sanitizing `next` and `/auth/signout` origin check untested | low | Pre-verified | patch: route tests |
| 16 | verification-gap | `?error=` contract between `callbackFallbackUrl` and `errorFromParam` untested | low | Pre-verified | patch: move `errorFromParam` into `auth-rules.ts`, round-trip test |
| 17 | verification-gap, intent-alignment | Hook message → `error_description` marker not verified against real Supabase | maybe-false | Needs a live rejected sign-in; the user is testing a second account on Preview | defer (manual Preview check) |
| 18 | intent-alignment | Dev/prod state (allowlist, env, sign-up, hook, provider) not in the diff | false | Done outside the repo and recorded in Implementation Notes | reject |
| 19 | intent-alignment | An account that passes the hook but fails `ALLOWED_EMAIL` briefly holds a session | false | Hook blocks new accounts before creation; the second gate signs out immediately, matching the decision | reject |
| 20 | intent-alignment | Log out only on `/` | false | Planned: the app shell (entry 8) adds it everywhere | reject |

## Design Notes

Popup memakai origin yang sama, jadi cookie sesi yang diset di `/auth/callback` dalam popup langsung berlaku untuk jendela pembuka; popup mengirim `postMessage({ type: "whe-auth", status })` ke `window.opener` dengan target origin sendiri, lalu `window.close()`. Bila tidak ada `opener` (popup dibuka sebagai tab biasa), callback langsung redirect ke `next`. `window.open` harus dipanggil sinkron di handler klik agar tidak diblokir. Zona waktu (`Intl.DateTimeFormat().resolvedOptions().timeZone`) dan `next` ikut lewat query `redirectTo` dan divalidasi di callback. Sesi ±30 hari: refresh token Supabase tidak kedaluwarsa secara default dan cookie `@supabase/ssr` bertahan lama; tidak perlu konfigurasi tambahan selain tidak mengaktifkan batas sesi.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: bersih; CI hijau.

**Manual checks:**
- MCP `list_migrations` di `dev` dan `prod` sama (tiga migrasi); `private.auth_allowlist` berisi satu baris di keduanya.
- Preview (dev) lalu Production: login akun diizinkan, akun lain ditolak, Log out, macro POST tanpa sesi.
