---
title: 'Tracer: scaffold with-supabase ter-deploy ke Vercel Production'
type: 'chore'
ticket: '1'
created: '2026-10-23'
status: 'built'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
baseline_revision: '9933b37a1ba74fc2c86de1c464658bb3a6a2dbf4'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Repo ini belum punya aplikasi. Epic fondasi butuh jalur tipis yang membuktikan Next.js, Supabase `prod`, dan Vercel Production tersambung sebelum entry lain dibangun di atasnya.

**Approach:** Scaffold `create-next-app -e with-supabase` di root repo (berdampingan dengan `_bmad*` dan `reference_ux`), selaraskan versi dengan spine Stack (Next 16.4.x, React 19.3.x, Tailwind 4.x, `eslint-config-next` sesuai major Next, Supabase SDK dipin), dan buang halaman auth password/sign-up dari starter karena bertentangan dengan CAP-17. Tambahkan halaman `/health` (dinamis, tanpa cache) yang memanggil endpoint health Auth Supabase dan menampilkan status OK/FAIL, `VERCEL_ENV`, dan `VERCEL_GIT_COMMIT_SHA`. Lalu buat Supabase project `prod` dan project Vercel yang ter-link ke repo GitHub, isi env var publik Supabase, dan deploy ke Production.

**Decisions (user, 2026-10-23):**
- Kode sampai ke Production lewat PR ke `main` yang dibuka agent dan di-merge user; Vercel men-deploy `main` ke Production.
- Supabase project `excel-practice-prod` dibuat di org "Fatahillah Aditya M", region `ap-southeast-1`; fungsi Vercel di `sin1`.
- "Allow new users to sign up" di Supabase `prod` dimatikan user sampai entry 1.7 memasang allowlist; halaman sign-up starter dihapus.
- Env var Supabase diisi untuk target Production saja; Preview baru tersambung ke `dev` di entry 1.5, jadi `/health` di Preview boleh menampilkan bahwa env belum diisi.

</frozen-after-approval>

## Implementation Notes

Oneshot: kode yang ditulis tangan sekitar 100 baris (`/health`, konfigurasi, pembersihan starter); sisanya hasil generate starter dan langkah setup akun.

Temuan investigasi (2026-10-23):
- Starter `with-supabase` (vercel/next.js canary) memakai `next: latest`, Tailwind 3.4 + `tailwindcss-animate`, `eslint-config-next` 15.3.1, dan blok auth password (login, sign-up, forgot password). Spine Stack mengikat Tailwind 4.3.x; CAP-17 melarang pendaftaran dan password.
- Supabase org: "Fatahillah Aditya M" (`ydsnogrdkvadubspefho`). Project yang ada: "Keuangan Keluarga" (aktif) dan "DB Personal Website" (inactive). Free plan mengizinkan 2 project aktif, jadi `prod` muat; project `dev` untuk entry 5 akan jadi project aktif ketiga.
- Vercel account `team_HAyNTAU0dP4JurQxnaigJm8u`; project yang ada: personal-website, keuangan-keluarga, optimus-the-ai-platform-to-bu.
- Repo root tidak kosong, jadi starter di-scaffold di folder sementara lalu dipindahkan ke root.

Keputusan implementasi (2026-10-23):
- Starter diambil dari `vercel/next.js` canary `examples/with-supabase` (commit `ba182aa1`) lewat sparse clone, karena `create-next-app -e` gagal di container (GitHub API 403).
- Kode dipindah ke `src/` sesuai Structural Seed spine: `src/app`, `src/proxy.ts`, `src/lib/utils.ts` (`cn` untuk shadcn), dan helper Supabase starter ke `src/adapters/supabase/{server,proxy}.ts`. Client browser starter (`client.ts`) dibuang karena AD-9 (browser tidak memanggil Supabase). Alias `@/*` → `./src/*`.
- Dibuang dari starter: `app/auth/*`, `app/protected/*`, semua komponen tutorial/auth/hero/theme, semua `components/ui/*` (shadcn v3; app shell entry 8 menambah ulang lewat shadcn CLI 4.22), `next-themes`, font Geist (DESIGN: system font), dan dependensi Radix/lucide/cva yang tidak lagi dipakai.
- Proxy hanya me-refresh sesi (`getClaims()`); redirect ke `/auth/login` dihapus karena halaman login baru ada di entry 7. `hasEnvVars` pindah ke adapter (adapter tidak mengimpor `src/lib`).
- Tailwind 3.4 → 4.3.3 ditulis manual (`@import "tailwindcss"`, `@theme inline`, `@tailwindcss/postcss`); `tailwind.config.ts` dihapus. Token warna dasar Dark Excel dan stack font dari DESIGN.md; pasangan light menyusul di app shell.
- ESLint pakai flat config bawaan `eslint-config-next` 16 (`core-web-vitals` + `typescript`) dengan ignore untuk `_bmad*`, `.claude`, `reference_ux`. ESLint tetap `^9`: `eslint-plugin-react` 7.37.5 belum mendukung ESLint 10.
- Versi seed yang terpasang: next 16.4.2, react/react-dom 19.3.1, @supabase/ssr 0.12.7, @supabase/supabase-js 2.118.0, tailwindcss 4.3.3, eslint-config-next 16.4.2, typescript ^5 (5.9.3), `engines.node` `24.x`. `npm audit` melaporkan 5 high di `braces` lewat `@next/eslint-plugin-next` → `fast-glob`; hanya toolchain lint (dev), tidak masuk bundle.
- `next.config.ts`: `cacheComponents` + `partialPrefetching` keduanya `true` (Next 16.4 menyarankan keduanya untuk project baru).
- Bahasa: `<html lang="en">` dan semua chrome berbahasa Inggris (EXPERIENCE.md Foundation › Language, Voice and Tone).
- `/health` adalah Server Component dengan isi dinamis di dalam `<Suspense>` (wajib karena `cacheComponents: true`); `await connection()` membuatnya dirender per request. Memanggil `GET {SUPABASE_URL}/auth/v1/health` dengan header `apikey` publishable key, `cache: 'no-store'`, timeout 5 s; URL probe dibangun dengan `new URL('/auth/v1/health', base)` dan URL env yang tidak valid dilaporkan sebagai FAIL. Menampilkan OK/FAIL, project ref dari URL, `VERCEL_ENV`, dan `VERCEL_GIT_COMMIT_SHA` (fallback `local`).
- Key yang dipakai adalah publishable key modern (`sb_publishable_…`), bukan anon JWT legacy. `vercel.json` menetapkan `regions: ["sin1"]`.
- `.gitignore`: `!.env.example` (aturan `.env.*` lama ikut mengabaikannya), artefak Next/Vercel, dan `_bmad/render/`.
- Container ini tidak bisa menjangkau `*.supabase.co` (proxy menolak koneksi), jadi lokal hanya terbukti jalur FAIL: tanpa env → "Supabase env not set"; dengan env `prod` → "Supabase unreachable" + project ref `njkftlwsfpggrciyrwim`. Jalur OK dibuktikan di Vercel (lihat butir deployment di bawah).
- Supabase `prod`: ref `njkftlwsfpggrciyrwim`, `ap-southeast-1`. Project Vercel `excel-practice` (`prj_XsK8V22z4ulZeOjg7sNqJMQYFobE`) dibuat lewat MCP setelah user menyetujui akses tim; ter-link ke `FatahillahAM/Excel-Practice`, Node 24.x, env publik Supabase hanya untuk target Production.
- Deployment pertama (`dpl_Av2dgTMtFnUyFqb4npnYM8fBmPce`, commit `81faac8`, region `sin1`) terpicu oleh push ke branch `claude/laughing-shannon-vnoryl`, tetapi Vercel memberinya target **production** dan alias `excel-practice-omega.vercel.app`, padahal default branch repo adalah `main`. `/health` di domain itu menampilkan OK, "Auth reachable", project `njkftlwsfpggrciyrwim`, `production`, dan SHA `81faac818c92121fa39cbc1c3f6ae1eb0f209a97`. Pengaturan Production Branch Tracking tidak terbaca lewat MCP; user perlu memastikan nilainya `main` agar push branch lain tidak masuk Production dengan env `prod` (AD-13).
- Fetch dari container ke `*.vercel.app` juga diblokir; halaman dibaca lewat share link MCP, jadi akses publik Production (Vercel Authentication `all_except_custom_domains`) belum terbukti dari luar akun Vercel.

## Verification

**Commands:**
- `npm run build` -- expected: build sukses tanpa error type.
- `npm run lint` -- expected: tidak ada error lint (Next 16 tidak lagi menjalankan lint di `next build`).
- `curl -s https://<production-url>/health` -- expected: HTML memuat status OK, `production`, dan SHA commit yang ter-deploy.

**Manual checks (if no CLI):**
- Buka `/health` di URL Production di browser: status OK dari Supabase `prod` dan SHA commit sama dengan HEAD di `main`.
- Halaman `/auth/sign-up` dan `/auth/login` dari starter tidak ada (404).

## Review Triage Log

- Deploy ke Production belum terjadi — `false` sebagai cacat kode: deploy adalah langkah setelah user me-merge PR ke `main` (Decisions). Kalimat "Jalur OK dibuktikan" di notes diubah agar jelas belum terbukti (patch kata).
- Versi seed belum di Notes epic — `low`, nyata, tetapi build tidak boleh menulis file tiket → defer ke `deferred-work.md`.
- `<html lang="id">` — `medium`: EXPERIENCE.md Foundation › Language mewajibkan `lang="en"` dan baris 51 menyebut koreksi ini → patch.
- String chrome berbahasa Indonesia di `/` dan `/health` — `low`: EXPERIENCE.md Voice and Tone menetapkan label dan reason line pendek dalam bahasa Inggris → patch, semua chrome jadi Inggris.
- URL Supabase rusak: `new URL(url)` di `/health` di luar `try` — `low`, koreksi sederhana → patch (dilaporkan sebagai FAIL "Supabase URL is invalid"). Bagian proxy 500 untuk nilai placeholder — `false`: perilaku starter yang gagal keras dengan pesan jelas di log pada salah konfigurasi.
- URL probe dengan trailing slash jadi `//auth/v1/health` — `low`, akar sama dengan butir di atas (URL dirakit manual) → patch dengan `new URL('/auth/v1/health', base)`.
- Adapter mengimpor `@/lib/utils` — `low`: tabel Design Paradigm spine membatasi impor adapter → patch, `hasEnvVars` pindah ke `src/adapters/supabase/proxy.ts`.
- `src/adapters/supabase/client.ts` tak terpakai dan bertentangan arah AD-9 — `low`, cukup dihapus → patch.
- `cacheComponents` tanpa `partialPrefetching` memicu peringatan build — `low`, satu baris → patch (`partialPrefetching: true`, saran Next untuk project baru).
- Verification `npm run build` tidak memeriksa lint di Next 16 — `low` → patch, `npm run lint` ditambahkan ke Verification.
