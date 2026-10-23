---
title: 'S2: Apakah rumus dan nilai terbaca benar dari file simpanan Excel 2021?'
type: 'feature'
ticket: '3'
created: '2026-10-23'
status: 'in-progress'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
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
