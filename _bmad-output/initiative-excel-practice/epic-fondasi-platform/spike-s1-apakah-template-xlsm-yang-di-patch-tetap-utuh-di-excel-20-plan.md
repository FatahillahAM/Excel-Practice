---
title: 'S1: Apakah template .xlsm yang di-patch tetap utuh di Excel 2021?'
type: 'feature'
ticket: '2'
created: '2026-10-23'
status: 'in-progress'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
baseline_revision: '295610272f9112689f1c020d27059e4b59049cf3'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** AD-4 mengasumsikan template `.xlsm` buatan Excel 2021 bisa di-patch di level zip oleh Node dan tetap terbuka utuh dengan tombol Finish dan VBA. Bila tidak, WorkbookIO pindah ke fallback Python/openpyxl, jadi jawabannya dibutuhkan sebelum epic 2.

**Approach:** User membuat `assets/templates/exam.v1.xlsm` di Excel 2021 mengikuti panduan dan mengimpor modul VBA uji dari repo. Agent menulis patcher zip di `src/adapters/workbook` (jszip, tanpa pustaka spreadsheet), mencatat SHA-256 `vbaProject.bin` di registry template, lalu menghasilkan file uji ber-token acak yang dibuka user di laptop. Hasilnya dicatat sebagai temuan spike.

**Decisions (user, 2026-10-23):**
- Template masuk repo lewat upload GitHub web ke `assets/templates/` di branch `claude/laughing-shannon-vnoryl`; agent lalu `git pull`.
- Layout uji minimal: Instructions B2 judul, B4 skenario, B6:B10 lima perintah soal, tombol Finish di D2; sheet `Data` mulai A1. Layout final yang berbeda menaikkan versi template.

## Boundaries & Constraints

**Always:** hanya `src/adapters/workbook` yang menyentuh byte `.xlsm`. `xl/vbaProject.bin` keluar byte-identik. Teks ditulis sebagai inline string, sehingga `sharedStrings.xml` dan `calcChain.xml` tidak disentuh. Sumber VBA disimpan sebagai `.bas` di repo untuk direview. Workbook dan macro tidak memuat key atau password.

**Never:** POST dari macro (S3, entry 4); membaca rumus (S2, entry 3); siklus percobaan, DB, atau route handler; adapter Python (hanya bila S1 gagal); commit file hasil patch; menulis file tiket atau Notes epic (hasil spike dicatat lewat ticketing).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Patch normal | template + 3 property + sel per sheet | property terisi; sel string `inlineStr`, angka `<v>`; part lain dan `vbaProject.bin` tidak berubah | — |
| Sel kosong ber-style | `<c r="B4" s="5"/>` di template | nilai ditulis, `s="5"` dipertahankan | — |
| Baris atau sel belum ada | baris 7 tidak ada | `<row>` dan `<c>` disisipkan urut baris dan kolom | — |
| Teks khusus | `<`, `&`, `"`, baris baru | di-escape XML, `xml:space="preserve"` | — |
| Property hilang | template tanpa `WHE_ServerUrl` | — | error menyebut nama property |
| Sheet tidak ada | nama sheet salah | — | error menyebut nama sheet |
| Sel target berisi rumus | `<c r="B4"><f>…</f>` | — | error; menimpa rumus membuat `calcChain` basi |
| Angka tak hingga | `NaN`, `Infinity` | — | error menyebut sel |

</frozen-after-approval>

## Code Map

- `package.json` -- tambah `jszip` 3.10.2 (spine Stack) dan `vitest` 5.0.5, script `test`.
- `tsconfig.json` -- `paths` `@/*` → `./src/*`; skrip di `scripts/` ikut typecheck.
- `assets/`, `src/adapters/workbook/`, `scripts/` -- belum ada; dibuat entry ini.
- Container: tanpa Excel; Node 22.22 menjalankan `.ts` langsung; `openpyxl` 3.1.5 ada untuk cek baca lokal.

## Tasks & Acceptance

**Execution:**
- [x] `assets/templates/vba/modFinish.bas` -- `Public Sub Finish()` menampilkan MsgBox berisi tiga property `WHE_*` dari `ThisWorkbook.CustomDocumentProperties`; ASCII, CRLF -- macro uji S1, diperluas S3.
- [x] `assets/templates/README.md` -- panduan membuat `exam.v1.xlsm` di Excel 2021: sheet, sel, tombol, impor `.bas`, tiga custom property Text bernilai `TEMPLATE`, simpan `.xlsm` -- user membuat template persis sama.
- [x] `src/adapters/workbook/template-patch.ts` -- `patchTemplate(bytes, { properties, cells })` dan `vbaProjectSha256(bytes)` -- inti AD-4.
- [x] `src/adapters/workbook/template-patch.test.ts` -- Vitest untuk tiap baris I/O Matrix dengan zip sintetis dari jszip -- bukti tanpa Excel.
- [x] `src/adapters/workbook/templates.ts` -- registry `{ 1: { file, vbaProjectSha256 } }`; hash diisi setelah template masuk repo -- dasar `IDENTITY_ALTERED` (AD-6).
- [x] `scripts/spike-s1.ts` -- baca template, patch dengan data manufaktur contoh dan token acak, tulis ke folder output di luar repo, cetak kedua hash dan gagal bila berbeda -- artefak uji untuk laptop.
- [x] `assets/templates/exam.v1.xlsm` -- dibuat user (hitl), lalu `scripts/spike-s1.ts` dijalankan dan file hasil dikirim ke user.

**Acceptance Criteria:**
- Given file hasil patch dibuka di Excel 2021 laptop, when workbook terbuka, then tidak ada dialog perbaikan dan sheet Instructions tampil dengan data dan teks yang ditulis server.
- Given macro diizinkan, when tombol Finish diklik, then MsgBox menampilkan `WHE_AttemptToken` yang sama dengan yang dicetak `scripts/spike-s1.ts`.
- Given template dan file hasil, when hash dihitung, then SHA-256 `vbaProject.bin` keduanya sama dan sama dengan registry.

## Implementation Notes

- Template `exam.v1.xlsm` di-upload user (`c53e68f`, 19.836 byte, 16 part). Diperiksa sebelum patch: sheet `Instructions` dan `Data`; B2 `s="1"`, B4 dan B6:B10 `s="2"`, semuanya kosong; `Data` berisi `<sheetData/>`; tombol Form Control terhubung ke `[0]!Finish`; tiga property `WHE_*` bertipe `vt:lpwstr` bernilai `TEMPLATE`; tidak ada `sharedStrings.xml` atau `calcChain.xml`. `olevba` (oletools 0.60.2, di venv scratchpad) menunjukkan `modFinish` identik dengan `assets/templates/vba/modFinish.bas`, dan modul `ThisWorkbook`, `Sheet1`, `Sheet2` kosong.
- SHA-256 `vbaProject.bin` v1: `d8aa9aa6923880439ccd214c559fb48a731091158b0f3e3508c50d35eb11a9df`, dicatat di `src/adapters/workbook/templates.ts`.
- `node scripts/spike-s1.ts`: hash template dan hasil sama, registry `match`, exit 0. File uji `spike-s1-XD3PPwFf.xlsm` dengan token `XD3PPwFf6kNRsEmA7qCUBxatFrCUZxr7IVxIKhFJkng` dikirim ke user. Hanya `docProps/custom.xml`, `sheet1.xml`, `sheet2.xml` yang berubah; semua XML well-formed; openpyxl membaca style bold/wrap, teks dua baris dengan `&`, `<`, `"`, angka sebagai angka, dan ketiga property.

## Design Notes

Patch hanya menyentuh `docProps/custom.xml` (isi `<vt:lpwstr>` property `WHE_*`) dan XML sheet yang ditemukan lewat `xl/workbook.xml` + `xl/_rels/workbook.xml.rels`. Baris dan sel di `<sheetData>` diedit di tempat, bukan parse-lalu-serialisasi, agar namespace dan atribut Excel tetap persis. `<dimension>` tidak diubah; bila Excel mempermasalahkannya, itu temuan spike.

Vitest dipasang di sini karena patcher butuh tes; entry 6 menyambungkannya ke CI.

## Verification

**Commands:**
- `npm run test` -- expected: semua tes I/O Matrix lulus.
- `npm run lint` dan `npx tsc --noEmit` -- expected: bersih.
- `node scripts/spike-s1.ts` -- expected: kedua hash `vbaProject.bin` sama dan token tercetak.

**Manual checks (if no CLI):**
- Acceptance Criteria di laptop Excel 2021, setelah file di-Unblock atau ditaruh di Trusted Location.
