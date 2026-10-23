---
title: 'S1: Apakah template .xlsm yang di-patch tetap utuh di Excel 2021?'
type: 'feature'
ticket: '2'
created: '2026-10-23'
status: done
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
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

- Uji laptop user, Excel 2021, file `spike-s1-XD3PPwFf.xlsm`: terbuka **tanpa dialog perbaikan**. Sebelum Unblock, klik Finish memberi "Cannot run the macro … all macros may be disabled" karena Mark of the Web memblokir macro dari file unduhan. Setelah Unblock, Finish menampilkan `WHE_AttemptToken` `XD3PPwFf6kNRsEmA7qCUBxatFrCUZxr7IVxIKhFJkng` (sama dengan cetakan skrip), `WHE_ServerUrl` Production, dan `WHE_TemplateVersion` 1. Tampilan teks dan data di sheet belum dikonfirmasi eksplisit oleh user.
- Temuan spike (sementara, menunggu konfirmasi tampilan sheet): patch level zip di Node lolos S1. `<dimension>` dan `spans` yang basi serta inline string tanpa part `sharedStrings` tidak memicu perbaikan; VBA dan tombol Finish utuh. Unblock atau Trusted Location wajib sebelum Finish bisa jalan, sesuai panduan penyiapan CAP-16. Untuk S2: file hasil generate yang belum disimpan Excel membawa `<dimension>`/`spans` basi, jadi pembaca tidak boleh mengandalkannya. Masih terbuka: apakah Excel mengubah `vbaProject.bin` saat menyimpan (deferred-work).
- Patch review P1–P5 diterapkan (subagent terhenti oleh restart container, perubahan diperiksa ulang di disk): `templates.test.ts` baru, validasi karakter kontrol pada property, escape `_xHHHH_` dengan lookahead, `.gitattributes` (`*.bas -text`, `*.xlsm binary`), dan README tanpa nama branch. Verifikasi ulang: Vitest 17/17, lint dan `tsc --noEmit` bersih, `node scripts/spike-s1.ts` registry `match` exit 0. Patch tidak mengubah isi file uji yang sudah dibuka user.

## Review Triage Log

Pass 1 (thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment) -- medium 3, low 20, false 3, maybe-false 1.

- VG-1 `npm test` tidak membaca `exam.v1.xlsm` atau registry -- medium, patch P1: hash registry bisa menyimpang tanpa ada tes yang gagal; dasar AD-6 nanti.
- BH-6 tes tidak mengikat template nyata ke registry; fixture beda dari file Excel -- medium, patch P1 (akar sama dengan VG-1).
- IA-2 fixture tidak punya `<drawing>`/`<legacyDrawing>`/`<controls>` tombol Finish -- medium, patch P1: tidak ada tes bahwa markup tombol bertahan.
- IA-3 fixture punya `sharedStrings`/`calcChain`, file nyata tidak -- low, patch P1 (akar sama).
- VG-2 nilai property tidak dicek karakter kontrol XML -- low, patch P2: probe dua lensa menulis U+0007 mentah ke `custom.xml`; koreksi langsung.
- BH-2 sama dengan VG-2 -- low, patch P2.
- ECH-1 property dengan karakter kontrol atau CR -- low, patch P2 untuk karakter kontrol; bagian CR ditolak: CR sah di XML dan token/URL tidak memuatnya.
- BH-3 `_xHHHH_` berurutan salah di-escape -- low, patch P3: dibuktikan `_x0041_x0042_` → `_x005F_x0041_x0042_`; regex lookahead.
- BH-8 tanpa `.gitattributes`, `.bas` bisa berubah ke LF -- low, patch P4: impor VBE butuh CRLF; dua baris konfigurasi.
- ECH-11 sama dengan BH-8 -- low, patch P4.
- BH-9 README menulis mati branch sementara; belum ada prosedur v2 -- low; nama branch patch P5 (koreksi langsung); prosedur v2 ditolak, ditulis saat v2 dibuat.
- BH-1 uji simpan tidak ada: Excel mungkin menulis ulang `vbaProject.bin` saat save -- maybe-false (high bila benar), defer: bukan disebabkan perubahan ini, menyangkut AD-6; terjawab dengan membandingkan hash file yang disimpan Excel. User diminta uji simpan opsional.
- BH-4 `<dimension>` basi -- low, ditolak: Excel membuka file tanpa dialog perbaikan (user), server membaca file kiriman yang disimpan ulang Excel; perbaikan butuh kode bounding box. Dicatat sebagai batasan S2.
- ECH-5 sama dengan BH-4 -- low, ditolak.
- ECH-6 atribut `spans` basi -- low, ditolak (akar sama dengan BH-4).
- BH-5 teks sel > 32.767 karakter tidak ditolak -- low, ditolak: konten pendek, perbaikan menambah guard.
- ECH-3 sama dengan BH-5 -- low, ditolak.
- ECH-4 property > 255 karakter -- low, ditolak: token 43 karakter, URL pendek; guard baru.
- ECH-2 surrogate tak berpasangan → U+FFFD -- low, ditolak: konten dari kode, guard baru.
- BH-7 jalur error tanpa tes -- low, ditolak: semua gagal keras. Bagian `<property/>` self-closing false: skema mewajibkan elemen nilai dan Excel tidak menulisnya.
- BH-10 peringatan `MODULE_TYPELESS_PACKAGE_JSON`; `--template` tetap memberi label v1 -- low, ditolak: kosmetik, khusus skrip spike.
- BH-11 metadata template (creator, `absPath`, `modified`) ikut ke tiap file -- low, ditolak: app satu user, file kembali ke user yang sama, waktu mulai dicatat server.
- ECH-9 `--out` symlink ke repo lolos guard -- low, ditolak: butuh symlink sengaja.
- ECH-10 versi tanpa entri registry → TypeError -- low, ditolak: gagal keras saat start.
- ECH-7 rumus yang bergantung pada sel tertulis jadi basi -- false: v1 tanpa rumus dan `calcChain`, README melarang rumus.
- ECH-8 sel di header tabel -- false: v1 tanpa tabel, README melarang isi lain.
- IA-1 jawaban spike belum ada di diff -- false: hasil laptop sedang diuji user dan dicatat lewat ticketing sesuai Boundaries.

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
