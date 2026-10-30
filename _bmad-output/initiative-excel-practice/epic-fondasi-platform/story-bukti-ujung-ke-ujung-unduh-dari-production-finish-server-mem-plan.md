---
title: 'Bukti ujung-ke-ujung: unduh dari Production, Finish, server membaca token dan rumus'
type: 'feature'
ticket: '9'
created: '2026-10-30'
status: 'in-review'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: 'a4bb8d75de2d5c236eae6317f6cd83cc9e032c30'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** S1–S3 terbukti terpisah dengan file dari `scripts/spike-s1.ts`. Belum ada file yang dibuat oleh Production untuk user yang login, lalu kembali ke Production lewat Finish dan terbaca server (epic Done when 5).

**Approach:** Halaman `/dev/bridge-proof` (di dalam shell, tanpa menu nav) mengunduh `exam.v1.xlsm` yang di-patch dengan token baru dan `WHE_ServerUrl` origin request. Server mencatat hash token itu untuk user. `POST /api/submissions/macro` membaca file lewat adapter workbook, lalu mencatat ke baris yang token-nya cocok: waktu terima, cocok token/sidik jari, dan teks rumus. Halaman menampilkan catatan itu.

**Decisions (user, 2026-10-30):**
- Macro route menulis lewat client service-role `SUPABASE_SECRET_KEY` (AD-9, jalur macro). User menyalin secret key `dev`/`prod` ke Vercel env (Production → prod; Preview/Development → dev) dan `.env.local`; agent tidak pernah melihat nilainya.
- Plan tetap satu (sekitar 1.900 token) karena semua bagian baru teruji bersama di laptop.
- Unduh tanpa sesi dialihkan ke Login oleh proxy (bukan 401), lalu kembali ke link Unduh setelah login (user, 2026-10-30, matrix audit).

## Boundaries & Constraints

**Always:**
- Hanya `src/adapters/workbook` yang menyentuh byte `.xlsm` (AD-4).
- Token = 32 byte acak base64url. DB dan log hanya menyimpan SHA-256-nya, tidak pernah tokennya.
- Download route memeriksa sesi.
- Balasan macro route tetap sama dengan S3 (`{ok, data}` / `NOT_EXCEL` / `IDENTITY_ALTERED`).
- Migrasi baru diterapkan ke `dev` lalu `prod` dan menyetel `schema_version`.
- RLS aktif dengan policy owner-only.

**Never:**
- `attempts`/`submissions` atau `submit()` (epic 2).
- Kunci secret di repo, workbook, atau bundle browser.
- Mengubah `read.ts`, `template-patch.ts`, registry, atau `exam.v1.xlsm`.
- Menyimpan byte file.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Unduh | user login, klik Unduh | `.xlsm` berisi `WHE_AttemptToken` baru, `WHE_ServerUrl` = origin, `WHE_TemplateVersion` 1, Instructions + Data terisi; satu baris proof (hash, user, versi) | gagal insert → 500, tanpa file |
| Unduh tanpa sesi | tanpa cookie | 307 ke `/login?next=/dev/bridge-proof/download` (proxy, `/dev/*` adalah halaman); route sendiri 401 `UNAUTHENTICATED` bila request lolos tanpa sesi | — |
| Finish dari file unduhan | token + sidik jari cocok, SUMIFS di `Data!I2` | 200 seperti S3; baris proof: `received_at`, `bytes`, kedua cocok `true`, rumus sel (ref + teks ternormalisasi) | — |
| Finish dua kali | file yang sama | baris diperbarui ke kiriman terakhir, `receive_count` naik | — |
| Token tak dikenal | file `spike-s1` lama | balasan seperti S3; tidak ada baris yang berubah; log `proofRecorded: false` | — |
| File diubah | header ≠ token, atau VBA diubah | `IDENTITY_ALTERED` seperti S3; tetap dicatat bila token file berbentuk sah (cocok `false`) | — |
| Gagal tulis DB | Supabase error | balasan macro tetap dari inspeksi; log `proofRecorded: false` | tidak melempar |

</frozen-after-approval>

## Code Map

- `src/adapters/workbook/template-patch.ts` -- `patchTemplate(bytes, {properties, cells})`. Pakai apa adanya.
- `src/adapters/workbook/templates.ts` -- `templates[CURRENT_TEMPLATE_VERSION].file` (path dari root repo).
- `src/adapters/workbook/read.ts` -- `readWorkbook` → `sheets[name][ref].formula` (ternormalisasi, `_xlfn.` dibuang).
- `scripts/spike-s1.ts:45-110` -- contoh data manufaktur + teks Instructions + properties. Tiru bentuknya, jangan ubah skrip.
- `src/app/api/submissions/macro/inspect.ts` -- `inspectMacroSubmission`, `tokenSha256` (12 hex untuk log), `TOKEN_PROPERTY`, `TOKEN_RE`. Import relatif (Vitest tanpa config).
- `src/app/api/submissions/macro/route.ts` -- tempat memanggil pencatatan setelah inspeksi.
- `src/adapters/supabase/server.ts` -- `createClient()` (sesi user).
- `src/adapters/supabase/auth.ts` -- `getSessionUser()`.
- `src/adapters/supabase/profiles.ts` -- pola repository + log JSON `event`.
- `src/proxy.ts` / `src/adapters/supabase/proxy.ts` -- `/dev/*` sudah butuh sesi; API → 401. Jangan diubah.
- `src/app/(app)/` + `src/components/shell/page-title.tsx` -- halaman di dalam shell; `nav-items.ts` tidak ditambah.
- `supabase/migrations/` + `src/adapters/supabase/migrations.test.ts` -- penamaan, dan `schema_version` = versi file.
- `next.config.ts` -- template harus ikut bundle function (`outputFileTracingIncludes`).
- `assets/templates/vba/modFinish.bas` -- hanya mengirim ke `https://`, header `X-Attempt-Token`.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261030000001_bridge_proofs.sql` -- buat tabel `bridge_proofs`:
  - kolom: `id`, `user_id` (default `auth.uid()`), `token_sha256` (64 hex, unique), `template_version`, `created_at`, `received_at`, `receive_count`, `bytes`, `token_matches`, `fingerprint_matches`, `formulas` (jsonb);
  - RLS dengan policy owner select/insert, tanpa policy update;
  - revoke lalu grant minimal;
  - `schema_version` disetel; diterapkan ke `dev` lalu `prod` dengan rename versi.
  - Rationale: tempat bukti bertahan di antara dua request.
- [ ] `src/adapters/workbook/generate.ts` -- `generateExamWorkbook({token, serverUrl, cells})`: membaca template versi sekarang, mem-patch, lalu mengembalikan `{bytes, templateVersion}`. Rationale: bentuk `generate()` AD-4 untuk epic 2.
- [ ] `src/adapters/supabase/service.ts` -- client service-role dari env server-only, dipakai hanya di macro route. Rationale: AD-9.
- [ ] `src/adapters/supabase/bridge-proofs.ts` -- tiga fungsi:
  - `createBridgeProof` (sesi user);
  - `listBridgeProofs` (sesi user, 5 terbaru);
  - `recordBridgeProofReceipt` (service): update by hash, `receive_count + 1`, rumus maks 20 sel, tidak melempar.
- [ ] `src/app/(app)/dev/bridge-proof/sample.ts` -- data soal dan teks Instructions; perintah B6 meminta SUMIFS di `Data!I2`.
- [ ] `src/app/(app)/dev/bridge-proof/download/route.ts` -- `GET` dengan cek sesi:
  - token baru, lalu insert proof, lalu generate;
  - balasan `Content-Disposition: attachment`, content type `.xlsm` macro-enabled, `no-store`.
- [ ] `src/app/(app)/dev/bridge-proof/page.tsx` -- tombol Unduh, langkah singkat (Unblock, Finish, muat ulang), dan tabel proof:
  - hash 12 hex, dibuat, diterima, jumlah kiriman;
  - token cocok, sidik jari cocok, rumus.
- [ ] `src/app/api/submissions/macro/route.ts` (+ `inspect.ts` bila perlu mengekspos rumus/hash penuh) -- setelah inspeksi, catat ke proof bila token file berbentuk sah. Log menambah `proofRecorded`.
- [ ] `next.config.ts` -- `outputFileTracingIncludes` untuk `assets/templates/**` di route download.
- [ ] Tes:
  - `generate.test.ts`: properti dan sel terbaca kembali, sidik jari tetap cocok;
  - `bridge-proofs.test.ts`: client palsu, batas 20 sel, tidak melempar;
  - `download/route.test.ts`: 401, 500, dan header;
  - `macro/route.test.ts`: dicatat atau tidak per baris matriks.

**Acceptance Criteria:**
- Given file unduhan dari Production dibuka di Excel 2021 laptop (setelah Unblock), when `Data!I2` diisi SUMIFS lalu Finish, then muncul "Terkirim" dan, setelah muat ulang, `/dev/bridge-proof` menampilkan baris itu dengan token cocok, sidik jari cocok, dan teks `SUMIFS(...)` dari `Data!I2`.
- Given `npm run build`, when route download dibangun, then template ikut ter-trace (tidak ada ENOENT di Production).

## Implementation Notes

- Matrix audit: proxy sends `/dev/bridge-proof/download` without a session to Login (307); the user chose that over 401 and the matrix row was updated; `proxy.test.ts` covers it, the route's own 401 is in `download/route.test.ts`.
- Implementation makes no remote changes (no push, no Supabase or Vercel writes): write the migration file only; applying it to `dev` and `prod` and setting Vercel env happen after review.

## Plan Change Log

## Review Triage Log

Pass 1 (4 lenses): 0 high, 1 medium, 9 low, 3 false, 0 maybe-false. Patched 5 entries, deferred 1, rejected the rest. Intent alignment raised no intent gap: the diff builds the tooling for the proof, and the Production run is the planned manual check.

| # | Lens | Finding | Verdict | Evidence | Route |
|---|------|---------|---------|----------|-------|
| 1 | blind-hunter, edge-case-hunter, verification-gap | Proof row is inserted before generation; a generation failure leaves an orphan row, and that branch has no test | low | `download/route.ts` inserts, then `generateExamWorkbook` in `try`; the only 500 test is the failed insert | patch: generate first, insert after; test the generation-failure 500 (no insert, 12-hex log only) |
| 2 | blind-hunter, edge-case-hunter, intent-alignment | `<a download>` saves the 500 JSON or the Login HTML of an expired session as a file | medium | Same-origin `download` forces a save whatever the response is; this defeats the user's "redirect to Login" decision | patch: drop the `download` attribute (route already sends `Content-Disposition: attachment`) |
| 3 | verification-gap | `outputFileTracingIncludes` is checked by no test or CI build; a moved route or template ships a 500 with green CI | low | `next.config.test.ts` checks only redirects; CI does not build | patch: assert the key, that its glob covers `templates[CURRENT_TEMPLATE_VERSION].file`, and that the route file exists |
| 4 | blind-hunter, verification-gap | `TOKEN_RE` newly exported from `inspect.ts` but unused | low | No importer; `generate.ts` keeps its own copy | patch: drop the export |
| 5 | blind-hunter | `BridgeProof.tokenSha256` is a 12-hex prefix while the receipt field of the same name is the full hash | low | `toBridgeProof` slices to 12; a caller could pass it as a row key | patch: rename the display field `tokenSha256Prefix` |
| 6 | blind-hunter | A later post with a wrong header overwrites a matching receipt | false | Frozen matrix: "Finish dua kali → kiriman terakhir" and "File diubah → tetap dicatat (cocok false)"; designed behavior | reject |
| 7 | blind-hunter, edge-case-hunter | 20-cell cap can drop `Data!I2`; integer-like sheet names sort first | low | Needs more than 19 formulas ahead of I2 on a two-sheet proof workbook; fix adds ordering logic | reject |
| 8 | blind-hunter | Cap not enforced in SQL; strings unbounded | low | Only caller is the service-role macro path; body bounded by Vercel 4.5 MB | reject |
| 9 | blind-hunter | `service.ts` lacks `import "server-only"` | low | No client component imports it; key has no `NEXT_PUBLIC_` prefix; guard needs a new dependency | reject |
| 10 | blind-hunter, edge-case-hunter | Macro answer waits on the RPC; a hung database delays Finish | low | Recording is the proof's purpose; one indexed update; timeout or `after()` adds branches | reject |
| 11 | blind-hunter | Dev route imports `tokenSha256Hex` from the macro route module | low | Both are replaced in epic 2 (`submit()`, `attempts`); moving them now adds a module for a proof-only path | reject |
| 12 | blind-hunter | `/dev/bridge-proof` not gated by environment | false | Intent requires the proof on Production; only the allowlisted account has a session | reject |
| 13 | edge-case-hunter | Unauthenticated well-formed-token posts each trigger a service-role call, unthrottled | low | Spine Deferred: rate limiting revisited if the URL is shared; the post already costs a full workbook read | reject |
| 14 | verification-gap, blind-hunter, intent-alignment | Migration grants, RLS and the RPC are exercised only by mocks; page states not rendered | low | Implementer ran the migration once on a local Postgres; no DB or render harness in the repo (render harness deferred in 1.8) | defer: DB contract test with `attempts` in epic 2 |
| 15 | intent-alignment | Page copy is English, plan says "tombol Unduh" | false | Conventions › Copy: UI chrome English inside components | reject |

## Design Notes

- Tabel ini hanya untuk bukti dan akan dihapus di epic 2 setelah `attempts` ada. Hal ini dicatat di `deferred-work.md` setelah build.
- `WHE_ServerUrl` = `new URL(request.url).origin`: Production menghasilkan `https://excel-practice-omega.vercel.app` (AD-13). Preview terkunci Vercel Authentication, sehingga verifikasi dilakukan di Production.
- Hash penuh SHA-256 (64 hex) dipakai sebagai kunci baris. Log tetap memakai 12 hex.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: bersih.
- MCP `list_migrations` di `dev` dan `prod` -- expected: `20261030000001 bridge_proofs` di keduanya.

**Manual checks:**
- Laptop: unduh dari Production, Unblock, isi SUMIFS di `Data!I2`, Finish, lalu muat ulang `/dev/bridge-proof`. Log runtime Production memuat `proofRecorded: true`.
