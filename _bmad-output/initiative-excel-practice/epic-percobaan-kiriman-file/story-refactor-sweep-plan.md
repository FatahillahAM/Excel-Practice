---
title: 'Refactor sweep'
type: 'refactor'
ticket: '11'
created: '2026-11-06'
status: 'in-progress'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
baseline_revision: 'f283a6598d643121becdd85cae4e5de6fa386ba6'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic percobaan menyisakan 10 entri di `deferred-work.md` dari plan 2.1–2.9, 7 entri epic 1 yang dulu dipindah ke epic ini (Notes › Parked), satu deferral yang hanya ada di Review Triage Log 2.3, dan perapian dari catatan build: `scripts/spike-s1.ts` hanya jalan dengan `--experimental-transform-types`, builder fixture workbook terduplikasi antara tes route macro dan upload, impor relatif panjang karena Vitest tidak mengenal alias `@/`, prop `PlaceholderPage` yang selalu sama, tipe mati `UploadMessage`, dan jebakan Vercel Authentication di Preview untuk uji macro laptop yang belum tertulis.

**Approach:** Pekerjaan ini hanya pembersihan, tanpa perilaku baru:
- **Skrip tanpa flag:** dua parameter property di `src/adapters/workbook/read.ts` ditulis sebagai field biasa, dan `erasableSyntaxOnly` di `tsconfig.json` mencegahnya kembali; `node scripts/spike-s1.ts` cukup.
- **Alias `@/` di Vitest:** `vitest.config.ts` memetakan `@/` ke `src/`; impor yang keluar dari area `src/` sendiri memakai `@/` di luar `src/core`.
- **Satu sumber fixture:** tes route macro memakai `src/app/api/submissions/__fixtures__/files.ts` seperti tes upload.
- **Perapian kecil:** `PlaceholderPage` tanpa prop `enter`, `UploadMessage` dihapus, README template mencatat Vercel Authentication di Preview.
- **Disposisi:** setiap entri tertunda di epic ini ditutup (dengan bukti atau perbaikan di sweep ini) atau dipindah ke epic/story bernama dengan alasan, dicatat di `deferred-work.md` dan Parked Notes epic tujuan.

## Boundaries & Constraints

**Always:**
- Setiap perubahan kode tidak mengubah perilaku: teks pesan, route, status, dan bentuk respons tetap; jumlah tes tidak turun (kecuali tes yang digabung karena duplikat persis).
- `src/core/**` tetap memakai impor relatif di dalam core (AD-1 lint mengizinkan keduanya; tidak ada churn di core).
- Bukti untuk entri "closed" bisa diperiksa: commit, tes, log, atau baris database.

**Never:**
- Mengubah `modFinish.bas`, `exam.v1.xlsm`, atau registry template (butuh rebuild + uji laptop; v1 dirilis di 2.12).
- Migrasi, perubahan grant/RLS, atau perubahan setelan Supabase/Vercel (termasuk menyalakan lagi Vercel Authentication — itu tugas user sesudah uji laptop 2.10).
- DOM test harness, trigger AD-5 di database, kebijakan hapus Storage, atau Start Test di Level Detail Panel (dipindah, lihat Design Notes).
- Aturan ESLint baru untuk gaya impor.

</frozen-after-approval>

## Code Map

- `src/adapters/workbook/read.ts` -- `NotMacroEnabledError(readonly contentType)` (l. 62) dan `PartReader(private readonly zip)` (l. 206): satu-satunya sintaks non-erasable di `src` (dicek dengan `erasableSyntaxOnly`: tepat dua error TS1294).
- `scripts/spike-s1.ts`, `scripts/spike-s2.ts` -- impor `../src/**/*.ts` langsung lewat Node type stripping; header S1 masih menyuruh `--experimental-transform-types`.
- `assets/templates/README.md` (l. 95, 139), `src/adapters/workbook/__fixtures__/README.md` (l. 11) -- perintah `node --experimental-transform-types scripts/spike-s1.ts`.
- `package.json` -- `vitest` 5.0.5 (Vite 8.3.5), tanpa file config Vitest; `jszip` dipin `3.10.2`.
- `tsconfig.json` -- `paths: { "@/*": ["./src/*"] }` (Next dan tsc saja).
- ±62 file di `src/app`, `src/components`, `src/adapters`, `src/lib`, `src/hooks` -- impor dan `vi.mock` `../../…/(adapters|core|components|messages|content|lib|hooks)/…` (±170 baris); 21 file sudah memakai `@/`.
- `src/app/api/submissions/macro/route.test.ts` -- salinan lokal `repoRoot`, `VBA_PROJECT_PART`, `S3_FIXTURE`, pemuatan template, `newToken`, `patched`, `editZip`, `emptyDocumentModule`, `asPackage`, `streamOf`; `withAddedSheet` hanya dipakai di sini.
- `src/app/api/submissions/__fixtures__/files.ts` -- versi bersama (dipakai `upload/route.test.ts`); `asPackage` tanpa cek bahwa override content type ditemukan.
- `src/components/shell/page-title.tsx` -- `PlaceholderPage({ title, enter })`; tiga pemakai (`history`, `records`, `tips`) semua `enter`; JSDoc masih menyebut Settings.
- `src/messages/id.ts` -- `UploadMessage` (l. 73) tidak dipakai; komentar `[ASSUMPTION]` pada `NOT_EXCEL`, `tlsFailed`, `tempFailed`, `saveFailed`.
- `src/adapters/workbook/read.ts` › `InternalStreamSource` -- bounded inflate lewat `ZipObject#internalStream` privat JSZip.
- `_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md` › System message set (+ `.memlog.md`).
- `_bmad-output/implementation-artifacts/deferred-work.md`; epic `epic-penilaian-hasil-tips.md`, `epic-progres-streak-dashboard.md` (Parked harness note sudah ada dari 1.10).

## Tasks & Acceptance

**Execution:**
- [ ] `src/adapters/workbook/read.ts` -- ganti dua parameter property dengan field eksplisit yang diisi di constructor -- Node type stripping menolak parameter property.
- [ ] `tsconfig.json` -- `"erasableSyntaxOnly": true` -- `npm run typecheck` menangkap sintaks yang mematahkan skrip.
- [ ] `scripts/spike-s1.ts` (header), `assets/templates/README.md`, `src/adapters/workbook/__fixtures__/README.md` -- perintah jadi `node scripts/spike-s1.ts …` -- sesuai skrip sekarang.
- [ ] `vitest.config.ts` (baru) -- hanya `resolve.alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }` -- alias terbukti di Vitest 5 (probe di scratchpad); `include`/`exclude` bawaan tetap, `test`/`test:db` tidak berubah.
- [ ] File di luar `src/core` -- impor dan `vi.mock` yang naik `../` ke area `src/` lain (`adapters`, `core`, `components`, `messages`, `content`, `lib`, `hooks`, `app`) jadi `@/…`; impor `./x` dan `../x` di dalam folder fitur yang sama tetap relatif -- satu gaya, menutup temuan review 2.6 #12 dan 2.10 #9. Rewrite mekanis lewat skrip, lalu diff ditinjau; `scripts/` dan `next.config.test.ts` tetap relatif (Node/akar repo).
- [ ] `src/app/api/submissions/macro/route.test.ts` + `__fixtures__/files.ts` -- tes macro mengimpor builder bersama (template sebagai `Template` dari `loadTemplate()`); salinan lokal dihapus; `withAddedSheet` tetap lokal memakai `editZip`/`emptyDocumentModule` bersama; `asPackage` bersama melempar bila override `/xl/workbook.xml` tidak ditemukan (menggantikan `expect(types).toContain(XLSM_MAIN)` lokal).
- [ ] `src/components/shell/page-title.tsx` + tiga halaman -- `PlaceholderPage` selalu `page-enter`, prop `enter` dihapus, JSDoc tanpa Settings.
- [ ] `src/messages/id.ts` -- hapus `UploadMessage`; komentar `[ASSUMPTION]` keempat pesan macro menunjuk baris Message set baru.
- [ ] `src/adapters/workbook/read.test.ts` -- tes: versi `jszip` terpasang = `3.10.2` dan `ZipObject.prototype.internalStream` berupa fungsi, dengan pesan "periksa ulang bounded inflate sebelum menaikkan jszip" -- upgrade tidak bisa diam-diam mematikan guard zip bomb.
- [ ] `assets/templates/README.md` -- paragraf di bagian uji laptop: di Preview, Vercel Authentication (Project Settings › Deployment Protection) mengalihkan POST macro ke halaman login Vercel; macro melapor "File belum terkirim… Detail: HTTP 200" dan tidak ada log function. Matikan selama uji laptop di Preview (macro tidak bisa mengirim header bypass), nyalakan lagi sesudahnya; Production tidak terdampak.
- [ ] `EXPERIENCE.md` › System message set + `.memlog.md` -- baris illustrative (bukan *decided*) untuk Too large (upload + macro), Not an Excel file (macro), TLS gagal, TEMP gagal, Simpan gagal, teks verbatim dari `src/messages/id.ts`.
- [ ] `deferred-work.md` -- baris `status:` per entri pada tabel disposisi (format seperti 2.2/2.3: `done — …` atau `moved — <epic/story> (alasan)`).
- [ ] `epic-penilaian-hasil-tips.md`, `epic-progres-streak-dashboard.md`, `epic-percobaan-kiriman-file.md` -- Parked Notes untuk entri yang dipindah (epic 4: perluas catatan harness yang ada dengan permukaan epic 2); Decision 2.11 di epic ini.

**Acceptance Criteria:**
- Given repo sesudah sweep, when `node scripts/spike-s1.ts --out <tmp>` dijalankan tanpa flag di Node 24, then mencetak `registry check: match`.
- Given `src/` di luar `src/core`, when dicari impor `"(../)+(adapters|core|components|messages|content|lib|hooks|app)/`, then tidak ada hasil.
- Given `deferred-work.md`, when setiap entri dengan `source_plan` di epic ini dan setiap entri epic 1 yang diparkir di epic ini dibaca, then masing-masing punya `status:` yang cocok dengan tabel disposisi.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).

## Plan Change Log

## Review Triage Log

## Design Notes

- [ASSUMPTION] Alias, bukan relatif: `@/` sudah dipakai 21 file dan ditulis di spine/README; alasan satu-satunya untuk relatif (Vitest tanpa alias) hilang dengan satu config. `resolve.alias` dipilih karena terbukti; `resolve.tsconfigPaths: true` (Vite 8) boleh dipakai bila tes lulus, agar satu sumber dengan `tsconfig.json`. Core tetap relatif agar diff tidak menyentuh lapisan yang dijaga AD-1.
- [ASSUMPTION] `erasableSyntaxOnly` hanya memunculkan dua error di `read.ts` (diuji dengan tsconfig sementara); tidak ada `enum`/`namespace` di `src` (`RejectionCode` adalah objek `as const`).
- [ASSUMPTION] Baris EXPERIENCE.md mencatat teks yang sudah dikirim dan bertanda illustrative, seperti baris lain yang bukan *decided*; ini penyelarasan dokumen, bukan keputusan UX baru (preseden: 1.10 mengubah spine lewat sweep).
- [ASSUMPTION] Tulisan ke file tiket (Parked Notes, Decision) mengikuti preseden 1.10 (triage review 1.10: entri "moved" hanya di plan tidak terlihat oleh epic tujuan).
- `PlaceholderPage` tetap ada: History/Records milik epic 4, Tips milik epic 3; yang dibersihkan hanya prop yang selalu sama.
- Di luar sweep, tetap terbuka: uji laptop 2.10 (Trusted Location, temuan review 2.10 #7) milik 2.10 dan harus selesai sebelum 2.12; sesudahnya user menyalakan lagi Vercel Authentication di Preview (catatan laptop 2.9).

**Disposisi entri tertunda** (bukti dicek 2026-11-06):

| # | Entri (sumber) | Disposisi | Bukti atau alasan |
|---|---|---|---|
| 1 | Modul tak dipin diabaikan sidik jari (1.11, parked) | closed | 2.3: modul tak dipin wajib kosong/`Option` saja; status `done` sudah ada |
| 2 | Inflate tanpa batas di route macro (S3, parked) | closed | 2.3: body ≤ 4 MiB, ≤ 1000 entri, ≤ 32 MiB inflate; 2.5: upload lewat `readBoundedBody` yang sama (`http.ts`) |
| 3 | modFinish pesan per kode, petunjuk 413/TLS/TEMP, komentar `TempCopyPath` (S3, parked) | closed | 2.9: uji laptop langkah 6–13 (2026-11-06), komentar `TempCopyPath` "Always .xlsm" di `modFinish.bas` |
| 4 | Titik rilis template v1 (S3, parked) | moved → 2.12 | B7 milik 2.12 ("rilis template v1"); harus sesudah uji end-to-end |
| 5 | Profil tidak ada bila zona browser invalid (1.7, parked) | closed | 2.1: `requireProfile` di `start-actions.ts` membuat profil dari zona form, `profileMissing` bila tetap tidak bisa |
| 6 | Tes kontrak DB (1.9, parked) | closed | 2.2: `supabase/tests/contract.db.test.ts`, job CI `db-contract`; status `done` |
| 7 | Hapus `bridge_proofs` + `/dev/bridge-proof` (1.9, parked) | closed | 2.1: migrasi `20261102000002_drop_bridge_proofs` (dev dan prod); status `done` |
| 8 | File `attempt-files/<id>/` yatim saat baris dihapus (2.1; juga `submission-1` yatim, 2.3 #10) | moved → epic 3 | Butuh kebijakan hapus Storage atau job (perilaku baru); retensi `submission-<n>` diputuskan bersama penilaian, pembaca pertamanya; satu user, volume kecil |
| 9 | Loop polling/auto-download ExamStatus dan trace template di `/levels` (2.1) | moved → epic 4 (loop); trace closed | Loop butuh DOM harness (epic 4). Trace: `next.config.test.ts` menguji `outputFileTracingIncludes["/levels"]`, dan Start di Production (2.1) serta Preview (2.9) mengunduh file |
| 10 | DB tidak memagari tulisan status service role; CAS grader `lost` saat Abandon (2.2) | moved → epic 3 | Grader pengguna kedua tulisan service role; trigger dan penanganan `lost` diputuskan bersamanya |
| 11 | Bounded inflate bergantung `internalStream` privat JSZip (2.3) | closed | Tes pin versi + keberadaan `internalStream` di sweep ini (upgrade gagal keras) |
| 12 | Orbit Loader pause/play dan efek tick/poll/slow (2.4) | moved → epic 4 | DOM harness |
| 13 | Interaksi Upload Dropzone (2.5) | moved → epic 4 | DOM harness |
| 14 | Panel: Start Test, status lulus Test, eyebrow "Active" (2.6) | moved → epic 4 | Butuh konten Test (epic 5) dan progres hasil penilaian (AD-7); Level Map epic 4 membungkus panel ini |
| 15 | Insert sesi + `update (snapshot)` service role lewat PostgREST (2.8) | closed | Migrasi `20261104000001` ada di dev dan prod; di dev keenam percobaan Preview 2026-11-06 (abandoned 3, graded 2 via SQL, open 1) punya `snapshot` terisi, jadi kedua jalur PostgREST berhasil |
| 16 | Perilaku dialog Abandon (2.7) | moved → epic 4 | DOM harness |
| 17 | Pesan macro baru tanpa baris Message set (2.9) | closed | Baris EXPERIENCE.md di sweep ini |
| 18 | Tulisan Storage/status hanya lewat mock (2.3 triage #16, tidak ada di `deferred-work.md`) | closed | Uji laptop 2.9 di Preview dev: kiriman diterima, layar pindah ke received; kode penolakan per status |

Ringkasan: 10 closed, 8 moved (epic 3: 2, epic 4: 5, story 2.12: 1). Entri epic 1 lain yang dipindah ke epic 4 oleh 1.10 (harness render komponen) tidak berubah.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: bersih; jumlah tes sama atau +1 (tes pin jszip), kecuali duplikat yang digabung.
- `node scripts/spike-s1.ts --out <scratch>` dan `node scripts/spike-s2.ts` -- expected: jalan tanpa flag; S1 mencetak `registry check: match`.
- `grep -rnE '"(\.\./)+(adapters|core|components|messages|content|lib|hooks|app)/' src --include=*.ts --include=*.tsx | grep -v '^src/core/'` -- expected: kosong.

**Manual checks:**
- CI hijau di push branch kerja, termasuk job `db-contract`.
- `deferred-work.md` dan Parked Notes epic 3/4 cocok dengan tabel disposisi.
