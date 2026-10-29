---
title: 'Sign in with Google dengan allowlist satu akun'
type: 'feature'
ticket: '7'
created: '2026-10-29'
status: 'in-progress'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
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
- [ ] `supabase/migrations/20261029000003_auth_profiles.sql` -- schema `private` + `private.auth_allowlist(email)` (hanya `supabase_auth_admin` boleh baca), `public.hook_before_user_created(event jsonb)` (cocokkan email case-insensitive), `public.profiles(id → auth.users, time_zone, created_at)` RLS owner-only select/insert, `schema_version`.
- [ ] `src/adapters/supabase/auth.ts` + `profiles.ts` -- mulai OAuth Google, tukar kode, cek `ALLOWED_EMAIL`, sign out, buat profil sekali.
- [ ] `src/app/login/` -- halaman + Login Card (client) dengan popup, `postMessage` same-origin, status idle/loading/error/cancel.
- [ ] `src/app/auth/google/route.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/signout/route.ts` (POST).
- [ ] `src/adapters/supabase/proxy.ts` -- proteksi route + redirect `/login?next=`; 401 untuk API.
- [ ] `src/app/page.tsx` -- tombol Log out sementara.
- [ ] Tes Vitest untuk fungsi murni: `safeNext`, cocok allowlist, pemetaan hasil callback, klasifikasi path publik.
- [ ] `supabase/README.md` -- bagian "Auth (Google)": langkah dashboard Google Cloud dan Supabase.
- [ ] Terapkan migrasi ke `dev` lalu `prod`; isi `private.auth_allowlist` di keduanya; Vercel env `ALLOWED_EMAIL` (production, preview, development).

**Execution (user, dashboard):** OAuth client Google (redirect URI kedua project `…/auth/v1/callback`); di tiap project Supabase: provider Google on (client ID/secret), sign-up on, URL Configuration (Site URL + Redirect URLs `/auth/callback**`), hook Before User Created → `public.hook_before_user_created`.

**Acceptance Criteria:**
- Given Production, when akun `ALLOWED_EMAIL` login, then masuk ke Dashboard/`/` dan `profiles.time_zone` terisi.
- Given akun Google lain, when login, then pesan inline tanpa sesi dan tanpa baris di `auth.users`.
- Given sesi aktif, when Log out lalu buka `/`, then dialihkan ke `/login`; `POST /api/submissions/macro` tetap diterima tanpa sesi.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

Popup memakai origin yang sama, jadi cookie sesi yang diset di `/auth/callback` dalam popup langsung berlaku untuk jendela pembuka; popup mengirim `postMessage({ type: "whe-auth", status })` ke `window.opener` dengan target origin sendiri, lalu `window.close()`. Bila tidak ada `opener` (popup dibuka sebagai tab biasa), callback langsung redirect ke `next`. `window.open` harus dipanggil sinkron di handler klik agar tidak diblokir. Zona waktu (`Intl.DateTimeFormat().resolvedOptions().timeZone`) dan `next` ikut lewat query `redirectTo` dan divalidasi di callback. Sesi ±30 hari: refresh token Supabase tidak kedaluwarsa secara default dan cookie `@supabase/ssr` bertahan lama; tidak perlu konfigurasi tambahan selain tidak mengaktifkan batas sesi.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: bersih; CI hijau.

**Manual checks:**
- MCP `list_migrations` di `dev` dan `prod` sama (tiga migrasi); `private.auth_allowlist` berisi satu baris di keduanya.
- Preview (dev) lalu Production: login akun diizinkan, akun lain ditolak, Log out, macro POST tanpa sesi.
