---
title: 'Tracer: Start L1 P1 → unduh → Finish → File received'
type: 'feature'
ticket: '1'
created: '2026-11-02'
status: 'in-progress'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
baseline_revision: 'b5a5bb0292c3022d0f1d69cea790a1d01a1872df'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Jembatan Excel baru terbukti lewat `/dev/bridge-proof` dan `bridge_proofs`. Belum ada percobaan asli, jadi Start, simpan file, Finish, dan layar exam belum tersambung.

**Approach:** Tabel `attempts` dan bucket `attempt-files` dibuat lewat migrasi. Tombol Start L1 P1 di /levels membuat percobaan `open`, membuat `.xlsm` dari modul `01-fondasi`, menyimpannya, lalu membuka `/exam/[attemptId]`, yang mengunduh file dan polling status. Route macro mencari percobaan dari token dan menandainya `received`. Bukti epic 1 dihapus.

## Boundaries & Constraints

**Always:**
- Hanya `src/adapters/workbook` yang menyentuh byte `.xlsm` (AD-4).
- Token = 32 byte acak base64url. DB menyimpan `token_sha256` (64 hex, unique), log 12 hex, tidak pernah tokennya.
- `started_at`/`received_at` diisi DB (`now()`).
- File dibuat dan disimpan sekali di `attempt-files/<attemptId>/generated.xlsm`; unduh melayani byte itu.
- Sesi dicek di Server Action, download, status, dan halaman exam. Hanya route macro yang memakai service client (AD-9).
- Perubahan status = compare-and-set (`open` → `received`).
- Start butuh baris `profiles`.
- Balasan `NOT_EXCEL` / `IDENTITY_ALTERED` tetap seperti sekarang.

**Never:**
- `submit()` penuh, `ALREADY_GRADED`/`ATTEMPT_CLOSED`, batas ukuran (entry 3).
- Upload (entry 5), Level Detail Panel (entry 6), Attempt Card/Abandon (entry 7).
- Generator seed + skenario dan validasi poin (entry 8).
- Exam Status Line lengkap, waktu berjalan, Orbit Loader, pesan 15 s (entry 4).
- Mengubah template, `read.ts`, `template-patch.ts`, registry.
- Kunci secret di repo atau bundle browser.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Start | sesi, profil ada, tanpa percobaan terbuka | baris `open` (`item_id` `L01-P1`, `template_version` 1); file tersimpan; redirect `/exam/<id>`; unduhan mulai otomatis | gagal generate → tanpa baris; gagal upload → baris dihapus; pesan inline |
| Start tanpa profil | `profiles` kosong | `ensureProfile` dengan zona browser dari form; tetap kosong → pesan inline, tanpa baris | — |
| Start kedua | ada `open`/`received`/`grading_failed` | ditolak index unik → "Resume or abandon the attempt in progress first." + tautan ke layar exam percobaan itu | — |
| Unduh | `GET /exam/<id>/download`, pemilik | byte tersimpan, `attachment`, `.xlsm`, `no-store` | bukan pemilik/tak ada → 404; tanpa sesi → proxy ke Login |
| Finish | token + header + sidik jari cocok, `open` | `received`, `received_at`; 200 `{ok, data}` | — |
| Finish ulang | `received` | 200, tanpa perubahan | — |
| Token tak dikenal | file lama/`spike-s1` | 400 `NOT_THIS_ATTEMPT` | — |
| File diubah | header ≠ token, atau VBA ≠ `template_version` percobaan | `IDENTITY_ALTERED`, status tetap | — |
| Status | `GET /api/attempts/<id>/status` | `{ok, data: {status, elapsedSeconds, resultId: null}}` | tanpa sesi 401; bukan pemilik 404 `NOT_FOUND` |
| Layar exam | polling 2 s | `open`: "Excel is open — Practice 1" + "Klik Finish di file kalau sudah selesai, ya."; `received`: "File received — grading…" | fetch gagal → coba lagi di tick berikutnya |

**Decisions (user, 2026-11-02):** user meminta seluruh epic dijalankan sekaligus; plan disetujui tanpa checkpoint terpisah dan dibiarkan di atas batas token karena tiket tracer lintas lapisan.

</frozen-after-approval>

## Code Map

- `src/adapters/workbook/generate.ts` -- `generateExamWorkbook({token, serverUrl, cells})`; sel = `CellValue` (`string | number`). Pakai apa adanya.
- `src/app/api/submissions/macro/inspect.ts` -- urutan AD-6 (1)(2)(4); `tokenSha256`, `tokenSha256Hex`; bagian proof (`formulas`) dibuang.
- `src/app/api/submissions/macro/route.ts` -- pencatatan proof diganti lookup + received.
- `src/app/(app)/dev/bridge-proof/**`, `src/adapters/supabase/bridge-proofs.ts` (+tes) -- dihapus; `sample.ts` jadi data L01-P1.
- `src/adapters/supabase/{server,service,auth,profiles}.ts` -- client sesi, client service, `getSessionUser`, `ensureProfile`/`readTimeZone`.
- `supabase/migrations/20261030000001_bridge_proofs.sql` -- pola revoke/grant + RLS; `migrations.test.ts` -- `schema_version`.
- `next.config.ts` (+`next.config.test.ts`) -- `outputFileTracingIncludes` di-key `/dev/bridge-proof/download`.
- `src/app/(app)/levels/page.tsx` -- placeholder Level Map.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261102000001_attempts.sql` -- tabel `attempts` dan Storage:
  - kolom: `id`, `user_id` → `profiles(id)` (default `auth.uid()`), `item_id` (cek `^L\d{2}-(P[1-5]|T)$|^UA$`), `token_sha256` unique, `template_version`, `status` (check: `open`, `received`, `graded`, `grading_failed`, `abandoned`, `closed`; default `open`), `started_at`, `received_at`;
  - partial unique index `(user_id) where status in ('open','received','grading_failed')`;
  - RLS owner select/insert (insert hanya `item_id`, `token_sha256`, `template_version`); delete owner hanya `status = 'open'` (kompensasi Start); update hanya `service_role`;
  - bucket privat `attempt-files`; policy `storage.objects` insert/select bila folder pertama = id percobaan milik `auth.uid()`;
  - `schema_version`.
- [ ] `supabase/migrations/20261102000002_drop_bridge_proofs.sql` -- drop `record_bridge_proof_receipt` dan `bridge_proofs`; `schema_version`.
- [ ] `src/core/content/level-module.ts` -- tipe minimal `LevelModule` (`id`, `number`, `name`, `phase`, `hintQuota`, `items`) dan `LevelItem` (`id`, `kind`, `number`, `examCells()` → sel per sheet). Skema zod untuk bentuk statis. Rationale: AD-2; entry 8 menambah `generate(seed, scenario)`, skenario, soal, kunci.
- [ ] `src/content/levels/01-fondasi/{index,practice-1}.ts` + `src/content/levels/index.ts` -- modul Level 1 ("Fondasi", `hintQuota` 3), satu item `L01-P1` dengan data tetap dari `sample.ts` (modul asli, entry 8 menggantinya dengan generator). Registry plus `findItem(itemId)`.
- [ ] `src/adapters/workbook/token.ts` -- `newAttemptToken()`, `tokenSha256Hex`, `tokenSha256` (dari `inspect.ts`), agar Start tidak mengimpor route macro.
- [ ] `src/adapters/supabase/attempts.ts` -- `createAttempt`, `deleteOpenAttempt`, `findOpenAttemptId`, `readAttempt` (sesi); `uploadGeneratedFile`, `downloadGeneratedFile` (Storage, sesi); `findAttemptByTokenHash`, `markReceived` (service, CAS `status = 'open'`). Unique violation → `open_attempt_exists`. Log JSON tanpa token. Rationale: entry 2 memindah transisi ke `core/services/attempts`.
- [ ] `src/app/(app)/levels/{page,start-actions}.tsx` -- kontrol "Level 1 · Practice 1" dengan tombol "Start Practice 1" (zona waktu browser di input tersembunyi). Server Action: sesi → profil (`readTimeZone`, lalu `ensureProfile`) → item → token → generate (origin dari header) → insert → upload (gagal → delete) → `redirect('/exam/<id>?download=1')`. Tombol disabled selama pending; error di slot inline.
- [ ] `src/messages/id.ts` -- `startMessages.profileMissing` (ilustratif, seperti `preferenceSaveFailed`) dan `startFailed` = "Koneksi lagi bermasalah. Coba lagi sebentar, ya.".
- [ ] `src/app/(app)/exam/[attemptId]/download/route.ts` -- `GET`: sesi, `readAttempt` (RLS), `downloadGeneratedFile`; header seperti route proof; nama `L01-P1-<12 hex id>.xlsm`.
- [ ] `src/app/api/attempts/[attemptId]/status/route.ts` -- `GET`: sesi, RLS; `elapsedSeconds` = sekarang − `started_at`; `no-store`.
- [ ] `src/app/(app)/exam/[attemptId]/{page,exam-status}.tsx` -- server: `readAttempt` atau `notFound()` (di dalam Suspense, `cacheComponents`). Client: `?download=1` → navigasi sekali ke download lalu hapus query; polling 2 s selama `open`/`received`/`grading_failed`; `role="status"`; tautan "Download again".
- [ ] `src/app/api/submissions/macro/{route,inspect}.ts` -- setelah (1)(2): `findAttemptByTokenHash` → tak ada `NOT_THIS_ATTEMPT`; sidik jari vs `attempt.template_version` (4); `open` → `markReceived`; status lain → 200 tanpa perubahan. Log: `attemptId`, `channel`, `code`, `tokenSha256`, `received`. Service env hilang/DB error → 500 `INTERNAL_ERROR`, dicatat.
- [ ] `next.config.ts` + `next.config.test.ts` -- tracing template pindah ke `/levels` (Server Action Start).
- [ ] Hapus `src/app/(app)/dev/`, `bridge-proofs.ts`(+tes); tandai entri `bridge_proofs` di `deferred-work.md` selesai.
- [ ] Tes (client palsu) -- registry + `L01-P1`; repository (CAS, unique); Start action, download, status, dan macro route: tiap baris matriks.

**Acceptance Criteria:**
- Given Production di laptop (Excel 2021, file di-Unblock), when Start Practice 1 lalu Finish di file unduhan, then layar `/exam/<id>` berpindah sendiri ke "File received — grading…" tanpa muat ulang, dan `attempts` di `prod` menunjukkan `received` dengan `received_at`.
- Given `npm run build`, when Start berjalan di Production, then template ikut ter-trace (tanpa ENOENT).
- Given migrasi diterapkan, when `/dev/bridge-proof` dibuka, then 404, dan `bridge_proofs` tidak ada di `dev` maupun `prod`.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes): write the migration files only; the orchestrator applies them to `dev` then `prod` (with version rename, per `supabase/README.md`) after review.

## Plan Change Log

## Review Triage Log

## Design Notes

- Token unknown → `NOT_THIS_ATTEMPT` dipilih karena lookup by token memang dibutuhkan; kodenya sudah ada di enum. `ALREADY_GRADED`/`ATTEMPT_CLOSED` belum bisa terjadi (belum ada penilaian atau Abandon), jadi tetap entry 3.
- Kolom unique = hash token: file tersimpan sudah membawa token, server tidak perlu teksnya.
- Download di `/exam/*`, bukan `/api/*`: tanpa sesi ke Login (keputusan 1.9). Route mengalirkan byte lewat sesi + RLS Storage, bukan signed URL, agar nama file dan `no-store` terkontrol.
- Urutan Start: generate → insert → upload. Policy Storage butuh baris percobaan lebih dulu. Delete hanya `open` sebagai kompensasi, karena baris tanpa file mengunci Start lain.
- Sampai Abandon ada (entry 7), percobaan `received` mengunci Start. Untuk uji ulang, set `abandoned` lewat SQL di `dev`/`prod`.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: bersih; `.nft.json` Server Action `/levels` memuat `assets/templates/exam.v1.xlsm`.
- MCP `list_migrations` di `dev` dan `prod` (setelah diterapkan orchestrator) -- expected: `20261102000001` dan `20261102000002` di keduanya.

**Manual checks:**
- Laptop, Production: /levels → Start Practice 1 → file terunduh → Unblock, buka, Finish ("Terkirim") → layar exam menampilkan "File received — grading…" dalam ±2 s. Log runtime memuat `received: true` dengan `attemptId`.
