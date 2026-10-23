---
title: 'S2: Apakah rumus dan nilai terbaca benar dari file simpanan Excel 2021?'
type: 'feature'
ticket: '3'
created: '2026-10-23'
status: 'built'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: '4c5dd855df5a282ff3d0e7626bcbd10889362459'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Penilaian (AD-3) butuh teks rumus (termasuk shared formula hasil fill down) dan nilai cache dari file simpanan Excel 2021. Pustaka baca di balik WorkbookIO belum dipilih; fallback Python menunggu jawaban ini.

**Approach:** User mengisi file S1 di Excel 2021 dengan rumus fixture, menyimpannya, dan meng-upload ke repo. Agent menulis pembaca `readWorkbook` di `src/adapters/workbook` (jszip + fast-xml-parser) yang memperluas shared formula dan menormalkan teks rumus, lalu mencocokkan hasilnya per sel dengan tabel harapan dan pembacaan openpyxl. Hasil dan pilihan pustaka dicatat sebagai temuan spike.

**Decisions (user, 2026-10-23):**
- SheetJS tidak dibandingkan: `cdn.sheetjs.com` diblokir di container. Pembaca sendiri dicocokkan dengan tabel harapan dan openpyxl, dan blokir CDN dicatat sebagai bukti terhadap dependensi khusus CDN.

## Boundaries & Constraints

**Always:** hanya `src/adapters/workbook` yang menyentuh byte `.xlsm`. Rumus dinormalkan: tanpa `=`, prefiks `_xlfn.`/`_xlws.`/`_xlpm.` dibuang, huruf besar dan tanpa spasi di luar literal string. Pergeseran shared formula menggeser referensi relatif, mempertahankan `$`, dan tidak menyentuh isi string atau nama fungsi. `<dimension>` dan `spans` tidak dipercaya (temuan S1).

**Never:** menilai atau memakai `LevelModule`; menulis workbook; macro POST (S3); pustaka yang tak terjangkau dari container; menulis file tiket atau Notes epic.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Shared formula | anak `<f t="shared" si="0"/>` di H3 | rumus master digeser ke H3; `$` tetap | — |
| Prefiks fungsi baru | `_xlfn.XLOOKUP(…)`, `_xlfn.IFS(…)` | `XLOOKUP(…)`, `IFS(…)` | — |
| Angka diketik | sel tanpa `<f>` | `formula: null`, nilai angka | — |
| Hasil string | `t="str"` | nilai string | — |
| Shared string | `t="s"` (termasuk rich text `<r>`) | teks dari `sharedStrings.xml` | — |
| Boolean / error | `t="b"`, `t="e"` | `true`/`false`; kode error sebagai tipe `error` | — |
| Spill | jangkar `t="array" ref="L6:L8"`, L7:L8 hanya nilai | rumus hanya di L6; L7:L8 `formula: null` | — |
| Bukan workbook | zip rusak atau tanpa `xl/workbook.xml` | — | error menyebut alasannya |

</frozen-after-approval>

## Code Map

- `src/adapters/workbook/template-patch.ts` -- lookup sheet via `xl/workbook.xml` + rels dan `vbaProjectSha256`; pakai ulang, jangan ubah perilaku patch.
- `src/adapters/workbook/templates.ts` -- registry hash v1 untuk observasi hash file simpanan.
- `scripts/spike-s1.ts` -- data contoh `Data!A1:G11` untuk fixture; pola CLI.
- `package.json` -- tambah `fast-xml-parser` 5.11.2 (spine Stack).
- Container: `cdn.sheetjs.com` diblokir proxy; npm hanya punya `xlsx` 0.18.5; `openpyxl` 3.1.5 tersedia.

## Tasks & Acceptance

**Execution:**
- [x] `src/adapters/workbook/__fixtures__/README.md` -- panduan: buka file S1, ketik rumus fixture persis, fill down, simpan sebagai `s2-excel2021.xlsm`, upload ke folder ini di branch kerja -- user membuat fixture yang sama dengan tabel harapan.
- [x] `src/adapters/workbook/formula.ts` + `formula.test.ts` -- `normalizeFormula`, `shiftFormula(text, dRow, dCol)`; tes untuk relatif, `$`, rentang, kolom/baris penuh, referensi bersheet, string, nama fungsi seperti `LOG10`.
- [x] `src/adapters/workbook/read.ts` -- `readWorkbook(bytes)` → `{ sheets: { [sheet]: { [ref]: { formula, value, type } } }, properties, vbaProjectSha256 }`.
- [x] `src/adapters/workbook/read.test.ts` -- tes zip sintetis untuk tiap baris I/O Matrix, plus tes fixture yang membandingkan `s2-excel2021.xlsm` dengan tabel harapan (di-skip hanya bila file belum ada).
- [x] `scripts/spike-s2.ts` -- cetak tiap sel fixture (rumus ternormalisasi, nilai, tipe, cocok/tidak) dan hash `vbaProject.bin` file simpanan vs registry.
- [x] `src/adapters/workbook/__fixtures__/s2-excel2021.xlsm` -- dibuat user (hitl); agent lalu menjalankan skrip dan cek silang openpyxl.

**Acceptance Criteria:**
- Given fixture dari Excel 2021, when `scripts/spike-s2.ts` dijalankan, then setiap sel fixture cocok dengan tabel harapan (angka toleransi 1e-9).
- Given fixture yang sama, when dibaca openpyxl, then rumus dan nilai sama dengan `readWorkbook` setelah normalisasi.

## Implementation Notes

- Fixture `s2-excel2021.xlsm` di-upload user (`5ae399b`, 23.642 byte). `node scripts/spike-s2.ts`: semua sel fixture cocok (rumus ternormalisasi, nilai, tipe), cek silang openpyxl 126 sel cocok, exit 0. Vitest 57/57 termasuk tes fixture; lint dan `tsc --noEmit` bersih.
- C9 tersimpan `SUM(Data!F2:F11/SUM(Data!E2:E11))` karena kurung bergeser saat diketik; nilainya sama. Excel 2021 menyimpannya sebagai dynamic-array formula satu sel (`<f t="array" ref="C9">`, `cm="1"`), dan pembaca menanganinya. User memilih memakai rumus yang tersimpan sebagai harapan.
- Excel menyimpan shared formula dari fill down di H, I, J (master + anak `si`), prefiks `_xlfn.` untuk XLOOKUP, IFS, UNIQUE, dan spill UNIQUE dengan rumus hanya di L6. Teks hasil patch S1 (inline string) menjadi `sharedStrings.xml` setelah disimpan; `calcChain.xml` dan `metadata.xml` muncul.
- SheetJS tidak dibandingkan: `cdn.sheetjs.com` ditolak proxy (connect_rejected); npm hanya punya `xlsx` 0.18.5.
- `vbaProject.bin` berubah setelah Excel menyimpan (`9618df59…8ec4` ≠ registry `d8aa9aa6…a9df`). Per stream (olefile): `PROJECT` berubah karena `ID=` GUID project dan nilai `CMG`/`DPB`/`GC` dibuat ulang; `dir`, `_VBA_PROJECT`, `__SRP_*`, dan `VBA/Sheet1` (cache) berubah atau bertambah; `VBA/modFinish` byte-identik, dan sumber VBA hasil dekompresi semua modul identik (olevba). Jadi sidik jari AD-6 harus memakai sumber VBA per modul, bukan byte `vbaProject.bin`. Ini perubahan spine, dicatat di deferred-work.

- Patch review P1–P11 diterapkan oleh subagent implementasi: validasi XML sebelum parse, `<v>` kosong pada `t="s"` ditolak, `_xHHHH_` di-decode pada `t="str"`, hash `vbaProject.bin` dari zip yang sudah dimuat, tes entitas dan DOCTYPE, tes `sharedStrings.xml` hilang, tes fixture wajib jalan plus cek bentuk simpanan (shared, array, `_xlfn.`), README C9 dan koma desimal, dok urutan sheet dan peringatan hash. Verifikasi ulang: Vitest 65/65, lint dan `tsc --noEmit` bersih, `node scripts/spike-s2.ts` semua cocok (openpyxl 126 sel) exit 0, registry S1 `match`, `next build` sukses.

## Review Triage Log

Pass 1 (thorough: blind-hunter, edge-case-hunter, verification-gap, intent-alignment) -- medium 4, low 37, false 3, maybe-false 0 (44 temuan).

- VG-4 XML rusak lolos tanpa error (sheet terpotong terbaca sebagian, part non-XML jadi sheet kosong) -- medium, patch P5: dibuktikan probe; fast-xml-parser tanpa validator tidak melempar error. `XMLValidator.validate` sebelum parse.
- VG-1 tes fixture di-skip diam-diam bila file hilang -- medium, patch P2: cek utama spike bisa hilang tanpa merah.
- BH-3 sama dengan VG-1 -- medium, patch P2.
- BH-13 dok `vbaProjectSha256` dan `templates.ts` tidak memperingatkan bahwa hash berubah tiap save -- medium, patch P11: konsumen berikut akan menolak semua kiriman asli.
- BH-2 tes fixture tidak memeriksa bentuk simpanan (shared, array, `_xlfn.`) -- low, patch P2b: tambahan tes kecil yang mengunci klaim spike.
- BH-1 README C9 berbeda dengan `s2-expected.ts`; komentar header tidak benar lagi -- low, patch P1.
- IA-3 harapan C9 berasal dari file yang diuji, bukan dari README -- low, patch P1 (akar sama).
- ECH-16 sama dengan BH-1 -- low, patch P1.
- BH-15 README tidak menyebut koma desimal pada regional Indonesia -- low, patch P8: satu kalimat.
- VG-2 `processEntities: false` tidak dikunci tes (entitas ganda, DOCTYPE) -- low, patch P3: celah tes terverifikasi lewat mutasi.
- VG-3 error `sharedStrings.xml is missing` tanpa tes -- low, patch P4.
- ECH-3 `<v/>` kosong pada `t="s"` terbaca sebagai shared string pertama -- low, patch P6: dibuktikan probe; koreksi satu baris.
- BH-7 `_xHHHH_` tidak di-decode pada nilai `t="str"` -- low, patch P7: dibuktikan probe (`a_x000D_`).
- ECH-4 sama dengan BH-7 -- low, patch P7.
- BH-12 zip dimuat dua kali untuk hash -- low, patch P10: koreksi langsung.
- BH-8 klaim urutan sheet salah untuk nama mirip angka -- low, patch P9: hapus klaim di dok.
- IA-5 `CellReading` tidak menandai sel spill/array -- low, ditolak: sesuai baris Spill di I/O Matrix beku dan belum ada konsumen; dicatat sebagai batasan untuk grader epic 3/Level 6.
- BH-6 sama dengan IA-5 (termasuk array CSE multi-sel) -- low, ditolak.
- BH-4 spasi operator interseksi terhapus -- low, ditolak: aturan normalisasi beku mewajibkan tanpa spasi; kurikulum V1 tidak memakai interseksi.
- ECH-1 sama dengan BH-4 -- low, ditolak.
- IA-6 normalisasi lossy, teks mentah tidak dikembalikan -- low, ditolak: belum ada konsumen umpan balik; aturan beku.
- BH-5 `_xlfn.ANCHORARRAY`/`SINGLE` tidak dipetakan ke `#`/`@` -- low, ditolak: AD-3 menilai lewat checker fungsi dan nilai, bukan kesamaan rumus penulis.
- ECH-2 sama dengan BH-5 -- low, ditolak.
- BH-9 penemuan sheet via regex melewatkan `<x:sheet>` dan `r:id` tak terselesaikan -- low, ditolak: Excel 2021 menyimpan Transitional tanpa prefiks; hanya file rusak.
- ECH-5 Strict OOXML tanpa `xmlns:r` → `Error` biasa -- low, ditolak (akar sama dengan BH-9).
- ECH-6 sheet hilang diam-diam -- low, ditolak (akar sama).
- IA-7 rels dibaca dua cara -- low, ditolak (akar sama).
- BH-10 tipe error tidak konsisten; ref ganda saling timpa -- low, ditolak: file simpanan Excel well-formed; use case submit (epic 2) memetakan error pembaca ke `NOT_EXCEL`.
- ECH-9 ref ganda saling timpa -- low, ditolak (akar sama).
- BH-11 tanpa batas ukuran (zip bomb) -- low, ditolak: unggahan butuh sesi user tunggal atau token percobaan, body Vercel dibatasi; batas ukuran milik use case submit (epic 2).
- ECH-11 sama dengan BH-11 -- low, ditolak; bagian parse ganda dicakup P10.
- BH-14 helper duplikat dan cabang tanpa tes -- low, ditolak: kosmetik, entry 10 (refactor sweep).
- ECH-7 referensi karakter > U+10FFFF → RangeError -- low, ditolak: gagal keras.
- ECH-8 baris/sel tanpa `r` melewati batas -- low, ditolak: Excel selalu menulis `r`.
- ECH-10 root `macrosheet` -- low, ditolak: tidak relevan.
- ECH-12 skrip spike: `DataTableFormula` memecah `json.dump` -- low, ditolak: alat spike, fixture tanpa data table.
- ECH-13 skrip spike: format tanggal openpyxl -- low, ditolak (sama).
- ECH-14 skrip spike: perbandingan registry null/versi -- low, ditolak (sama).
- ECH-15 skrip spike: `spawnSync` tanpa timeout -- low, ditolak (sama).
- IA-2 cek openpyxl hanya di skrip manual -- low, ditolak: hasil 126 sel dicatat di Implementation Notes; CI tidak butuh Python.
- IA-4 tes sintetis beda bentuk dengan file nyata -- low, ditolak: tes fixture nyata menutupnya (P2 membuatnya wajib jalan).
- IA-1 tidak ada catatan temuan/pilihan pustaka di diff -- false: dicatat di Implementation Notes dan `Decision:` epic lewat ticketing setelah triase (keputusan user).
- IA-9 hasil fallback Python tidak dinyatakan -- false: sama dengan IA-1.
- IA-8 cakupan melebihi intent (properties, hash, `NotAWorkbookError`) -- false: tercantum di I/O Matrix beku dan definisi `WorkbookReading` spine.

## Design Notes

Fixture (Excel menampilkan nilai ini):

| Sel | Diketik user | Nilai |
|---|---|---|
| Instructions C6 | `=SUMIFS(Data!E2:E11,Data!B2:B11,"Lini A")` | 4125 |
| C7 | `=SUMIFS(Data!F2:F11,Data!C2:C11,"Malam")` | 226 |
| C8 | `=AVERAGEIFS(Data!G2:G11,Data!D2:D11,"Baut M8")` | 1250.5 |
| C9 | `=SUM(Data!F2:F11)/SUM(Data!E2:E11)`; fixture tersimpan `SUM(Data!F2:F11/SUM(Data!E2:E11))` (keputusan user) | 0.022998872604284102 |
| C10 | angka `226` | 226 |
| Data H2:H11 | `=F2/E2`, fill down | F/E per baris |
| I2:I11 | `=IF(H2>3%,"Periksa","OK")`, fill down | Periksa di baris 3, 7, 9 |
| J2:J11 | `=E2/SUM($E$2:$E$11)`, fill down | E/13305 |
| L2 | `=XLOOKUP("B-2610-05",A2:A11,F2:F11)` | 35 |
| L3 | `=INDEX(F2:F11,MATCH("B-2610-08",A2:A11,0))` | 31 |
| L4 | `=IFS(L2>30,"besar",TRUE,"kecil")` | besar |
| L5 | `=IFERROR(VLOOKUP("X",A2:F11,6,FALSE),"tidak ada")` | tidak ada |
| L6 | `=UNIQUE(B2:B11)` | spill L6:L8 Lini A, B, C |

`WorkbookReading` tinggal di adapter selama spike; pindah ke `src/core` di epic 3. Hash `vbaProject.bin` file simpanan adalah observasi untuk Unknown S3, bukan kriteria lulus.

## Verification

**Commands:**
- `npm run test` -- expected: semua tes lulus, termasuk tes fixture.
- `npm run lint` dan `npx tsc --noEmit` -- expected: bersih.
- `node scripts/spike-s2.ts` -- expected: semua sel fixture cocok; hash file simpanan dicetak.
