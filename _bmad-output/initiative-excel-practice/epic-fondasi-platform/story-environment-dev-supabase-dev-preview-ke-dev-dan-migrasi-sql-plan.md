---
title: 'Environment dev: Supabase dev, Preview ke dev, dan migrasi SQL'
type: 'chore'
ticket: '5'
created: '2026-10-29'
status: 'built'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
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

Implementasi (2026-10-29):
- Supabase: "Keuangan Keluarga" (`ckhrvgseaxzfiscikiji`) di-pause lewat MCP sesuai keputusan user; `excel-practice-dev` dibuat di org `ydsnogrdkvadubspefho`, `ap-southeast-1`, ref `krfkxropldheqhbqtkfo`.
- `supabase/config.toml` dari `supabase@2.121.0 init` (offline), `project_id = "excel-practice"`; `supabase/.temp/` dan `.branches/` di-ignore.
- `supabase/migrations/20261029000001_app_meta.sql`: tabel `app_meta(key, value, updated_at)`, RLS + policy `select` untuk `anon`/`authenticated`, `grant select`, baris `schema_version = 20261029000001`. Setiap migrasi berikutnya memperbarui baris ini.
- Diterapkan dengan MCP `apply_migration` ke `dev` (versi otomatis `20261029060624`) lalu `prod` (`20261029061021`); di kedua project versi riwayat diubah ke `20261029000001` lewat `update supabase_migrations.schema_migrations`. `list_migrations`: `dev` dan `prod` sama-sama `[20261029000001 app_meta]`; `prod` `app_meta.schema_version = 20261029000001`.
- `/health`: status OK kini juga butuh `schema_version` terbaca (`/rest/v1/app_meta?select=value&key=eq.schema_version`, publishable key, `no-store`, timeout 5 s); baris baru "Schema". Gagal baca → FAIL "Schema version unreadable".
- Vercel: env `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ke `dev` untuk target `preview` dan `development` (Production tetap `prod`). `.env.example` mengarahkan `.env.local` ke `dev`.
- Bukti Preview (deploy `dpl_D2TTmuHMQhNaLKUzGwJfzyvqVCnZ`, commit `26554a8`): `/health` OK, Project `krfkxropldheqhbqtkfo`, Schema `20261029000001`, Environment `preview`.
- Production masih menjalankan kode lama sampai branch di-merge ke `main`; tabel `app_meta` sudah ada di `prod`, jadi `/health` baru akan langsung OK setelah merge.
- Review fixes: `20261029000002_app_meta_read_only.sql` (revoke all, grant select, `schema_version` + `updated_at`) applied to `dev` then `prod` via MCP with the version rename; `readSchemaVersion` moved to `src/adapters/supabase/app-meta.ts`; `src/adapters/supabase/migrations.test.ts` checks file names and that each migration sets `schema_version` to its own version; `supabase/README.md` records how to write and apply migrations (CLI or MCP + rename).

## Verification

**Commands:**
- `npm run test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` -- expected: bersih.

**Manual checks:**
- `/health` di deploy Preview branch kerja: OK, project = ref `dev`, Environment `preview`, Schema = versi migrasi.
- MCP `list_migrations` di `dev` dan `prod`: satu migrasi, versi dan nama sama dengan file di `supabase/migrations`.

## Review Triage Log

- medium, defer — the `app_meta` select policy for `anon`/`authenticated` and an unauthenticated `/health` read break AD-9 as written ("owner-only policies", browser never calls tables): there is no session on `/health` and the service-role client is limited to the macro path, so the fix is a spine exception or reading it differently after Google sign-in (entry 7); recorded in `deferred-work.md`.
- low, patch — `grant select` was a no-op: Supabase default privileges gave `anon`/`authenticated` every privilege on `app_meta` (RLS blocked writes; TRUNCATE is not exposed by PostgREST). Migration `20261029000002` revokes all and grants select; both projects now show SELECT only.
- low, patch — the PostgREST read sat in `src/app`; moved to `src/adapters/supabase/app-meta.ts` (layer table: data access in adapters, app wires).
- low, reject — `app_meta` is not a plural name: it holds metadata rows (a mass noun), not entities; renaming costs a migration on both projects for no reader benefit.
- low, patch — `updated_at` would go stale: migrations now set it with `schema_version` (`20261029000002`, README convention).
- low, patch — nothing tied `schema_version` to the newest migration and the MCP version rename was undocumented: `migrations.test.ts` and `supabase/README.md`.
