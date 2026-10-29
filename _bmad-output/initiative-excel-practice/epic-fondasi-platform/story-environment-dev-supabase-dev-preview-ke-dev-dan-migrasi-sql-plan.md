---
title: 'Environment dev: Supabase dev, Preview ke dev, dan migrasi SQL'
type: 'chore'
ticket: '5'
created: '2026-10-29'
status: 'in-progress'
route: 'oneshot'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
baseline_revision: 'c3cdda4670df30cc24ae96d559a47c826585f2fc'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Hanya ada Supabase `prod`; Preview dan lokal belum punya pasangan `dev`, dan belum ada migrasi SQL di repo, jadi AD-13 (Preview/lokal ↔ `dev`, skema hanya lewat migrasi, `dev` lalu `prod`) belum berlaku.

**Approach:** Buat Supabase project `excel-practice-dev` (ap-southeast-1) di org yang sama, arahkan env Vercel Preview dan `.env.example` (untuk `.env.local`) ke `dev`, siapkan `supabase/` (config CLI 2.121.x) dengan migrasi pertama tabel `app_meta` berisi versi skema, terapkan ke `dev` lalu `prod`, dan tampilkan versi skema di `/health`.

**Decisions (user, 2026-10-29):**
- Paket gratis Supabase hanya memberi 2 project aktif dan keduanya terpakai; project "Keuangan Keluarga" di-pause agar `dev` muat.

</frozen-after-approval>

## Implementation Notes

Oneshot: kode sekitar 60 baris (migrasi, `/health`, `.env.example`, `supabase/config.toml`); sisanya langkah infrastruktur lewat MCP Supabase dan Vercel.

Temuan investigasi (2026-10-29):
- Supabase: kuota gratis "two active free projects… across all organizations where you are an Owner or Administrator; paused projects do not count" (docs Billing). Aktif: `excel-practice-prod` (`njkftlwsfpggrciyrwim`) dan "Keuangan Keluarga" (`ckhrvgseaxzfiscikiji`); `prod` belum punya migrasi.
- Container tidak menjangkau `*.supabase.co`, jadi Supabase CLI tidak bisa `db push`/`migration list` dari sini. Migrasi diterapkan dengan MCP `apply_migration`, yang memberi versi timestamp sendiri; versi `dev` dipakai sebagai nama file repo, dan baris riwayat `prod` disamakan ke versi itu agar `supabase migration list` nanti melihat riwayat yang sama. Cek "migrasi sama" memakai MCP `list_migrations` di kedua project.
- `/health` memakai `fetch` langsung dengan publishable key; versi skema dibaca dengan cara yang sama lewat PostgREST (`/rest/v1/app_meta`), sehingga tabel butuh RLS dengan policy `select` untuk `anon` dan `grant select`.
- Env Supabase di Vercel saat ini hanya untuk target Production.

## Verification

**Commands:**
- `npm run test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` -- expected: bersih.

**Manual checks:**
- `/health` di deploy Preview branch kerja: OK, project = ref `dev`, Environment `preview`, Schema = versi migrasi.
- MCP `list_migrations` di `dev` dan `prod`: satu migrasi, versi dan nama sama dengan file di `supabase/migrations`.
