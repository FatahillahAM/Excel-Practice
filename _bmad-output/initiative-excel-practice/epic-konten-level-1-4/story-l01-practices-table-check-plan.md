---
title: 'L01-P2..P5 dan pemeriksa Excel Table / Sort-Filter'
type: 'feature'
ticket: '2'
created: '2026-11-20'
status: 'in-progress'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/specs/spec-excel-practice/content-generation.md', '{project-root}/_bmad-output/specs/spec-excel-practice/level-curriculum.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Level 1 baru punya P1 dan T, jadi Test L01 tidak pernah terbuka (gerbang butuh 5 latihan berbeda) dan keterampilan Excel Table / Sort & Filter dari kurikulum tidak bisa dinilai karena checker hanya memeriksa sel, rumus dan nilai.

**Approach:** Tambah L01-P2..P5 dan satu cek baru `is_table` (sebuah range jadi Excel Table / ListObject dengan header yang benar) yang dibaca pembaca workbook dari part `xl/tables/*.xml` dan dinilai di core; Sort/Filter dinilai lewat hasil rumus (SORT, FILTER, SORTBY, nilai turunan). Satu soal Table masuk L01-T dengan kenaikan `contentVersion`.

## Boundaries & Constraints

**Always:**
- Spike dulu (tugas pertama): simpan satu file Table di Excel 2021 lalu pastikan `tableParts` / `xl/tables/tableN.xml` (`ref`, `headerRowCount`, `tableColumns`, `autoFilter`) terbaca; bila tidak, berhenti dan laporkan sebelum menulis konten.
- Data pembacaan Table masuk `WorkbookReading` (core type), parsing hanya di adapter (AD-2); batas zip/inflate yang ada tetap berlaku.
- Setiap latihan: R1–R7, 100 poin, jatah hint 3 (−5), Tip per soal, bank skenario L01 yang ada.
- Fixture Excel hanya untuk L01-T (ulang, karena soal Table baru) dan satu latihan (P2); P3–P5 memakai fixture buatan kode dengan nilai cache.
- `contentVersion` L01 naik; attempt lama tetap dinilai dengan snapshot-nya.

**Never:**
- Memeriksa urutan baris hasil klik Sort atau status AutoFilter yang di-klik user; menilai styling Table; nama Table wajib tertentu (kecuali soal menyebutnya).
- Level 2–4; perbaikan `_xludf.` / `t="str"` / intersection; migrasi DB.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Table benar | range data jadi Table, header baris 1 | `is_table` lulus | — |
| Bukan Table | range hanya diberi format/AutoFilter biasa | gagal, alasan "belum jadi Excel Table" | — |
| Table salah range | Table tidak mencakup semua baris data | gagal, alasan range Table | — |
| Dua Table / sheet lain | Table ada di sheet lain | dicari di sheet soal saja | gagal bila tidak ada |
| Table rusak | `tableN.xml` tidak valid / hilang padahal dirujuk | dianggap tidak ada Table | tanpa crash, `NotAWorkbookError` tidak dilempar |
| Sort via rumus | `=SORT(...)` / `SORTBY` | nilai cocok kunci, fungsi wajib dipakai | typed-values → `typed_value` |
| Fixture P2 / T | correct, typed-values, wrong-function | skor sesuai tabel README | — |
| Gerbang | P1..P5 selesai | L01-T terbuka | — |

</frozen-after-approval>

## Code Map

Depends on 5.1 (L01-T, `kindFromItemId`, golden pattern). Paths may shift once 5.1 lands.

- `src/adapters/workbook/read.ts` (+`read.test.ts`, `__fixtures__/`) -- sheet rels → `tableParts` → table XML.
- `src/core/grading/workbook-reading.ts` -- add `tables` per sheet.
- `src/core/content/checks.ts` -- `CHECKERS` names/params (`is_table`).
- `src/core/grading/checkers.ts`, `reasons.ts` -- checker + reason `not_a_table` / `wrong_table_range`.
- `src/adapters/workbook/generate.ts` -- code-built fixtures must be able to emit a Table part.
- `src/content/levels/01-fondasi/` -- `practice-1.ts` pattern, `test.ts` (5.1), `index.ts`, `__fixtures__/`.

## Tasks & Acceptance

**Execution:**
- [ ] spike: hand-saved Excel 2021 Table file (user step 0 below) committed to `src/adapters/workbook/__fixtures__/table-excel2021.xlsm` -- de-risk XML shape before content.
- [ ] `src/core/grading/workbook-reading.ts`, `src/adapters/workbook/read.ts` (+tests) -- parse tables: `{ name, ref, headerRow, columns[] }` per sheet; tolerant of missing/broken parts.
- [ ] `src/core/content/checks.ts`, `src/core/grading/checkers.ts`, `reasons.ts` (+tests on synthetic xlsx) -- `is_table` check with range + header assertions.
- [ ] `src/adapters/workbook/generate.ts` (or test helper) -- emit Table part for code-built fixtures.
- [ ] `src/content/levels/01-fondasi/practice-2.ts`..`practice-5.ts` (+tests) -- P2 Excel Table, P3 Sort via SORT/SORTBY, P4 Filter via FILTER/COUNTIF results, P5 mixed refs + fill; 100 points each.
- [ ] `src/content/levels/01-fondasi/test.ts`, `index.ts` -- add Table question, rebalance to 100, register P2..P5, bump `contentVersion`.
- [ ] `__fixtures__/l01-p2.ts`, `l01-p3..p5` code fixtures, `README.md`, `golden.test.ts` -- golden for all P2..P5 and re-saved L01-T.
- [ ] `src/core/progress/level-progress.test.ts` -- gate opens with real P1..P5.

**Acceptance Criteria:**
- Given the real L01 registry, when a user finishes P1..P5, then L01-T can start.
- Given any L01 item and two seeds, when generated, then data differs and keys equal recomputation.

## Implementation Notes

- Spike (Excel 2021, user, 2026-11-26) `src/adapters/workbook/__fixtures__/table-excel2021.xlsm`: sheet2 `<tableParts><tablePart r:id="rId1"/>` → rels Target `../tables/table1.xml`; table `name="Table1" displayName="Table1" ref="A1:G13" totalsRowShown="0"`, `<autoFilter ref="A1:G13"/>`, `<tableColumns count="7">` with `name` = header text, no `headerRowCount` attribute (default 1 = header on). Spill cached: Y2 `<f t="array" ref="Y2:Y13">_xlfn._xlws.SORT(Table1[Unit Diproduksi],1,-1)</f><v>1434</v>`, Y3..Y13 plain `<v>`; AA2 `t="str"` `_xlfn._xlws.FILTER(Table1[Kode Batch],Table1[Unit Diproduksi]&gt;1000)` spill AA2:AA8 `t="str"` values. So: spill cells carry cached values (no SMALL/LARGE fallback needed); function detection must strip `_xlfn.` AND `_xlws.` prefixes; formulas typed in a Table may use structured references (`Table1[Col]`) — checks that compare references must accept them or questions must target cells outside the Table / not depend on reference text.

## Plan Change Log

## Review Triage Log

## Design Notes

- [ASSUMPTION] Table check = structural only (exists on sheet, `ref` covers the data block, header row on, column names match data headers); AutoFilter on a Table is implied, not checked.
- [ASSUMPTION] Sort/Filter questions use dynamic-array functions (SORT, SORTBY, FILTER) allowed by Office 2021; spill result read from cached values of anchor + spill cells.
- [ASSUMPTION] The fixture practice is P2 (the Table one), since Table XML is the riskiest part.
- [ASSUMPTION] Re-saving L01-T fixtures is required because the Table question changes the item.

**User steps (hitl, ~30 min):**
0. Spike: open the agent's `table-spike.xlsm`, select the data block → **Ctrl+T** → **My table has headers** → OK → **Save** (xlsm); upload; tell the agent.
1. For `l01-p2-blank.xlsm` and `l01-t-blank.xlsm`: Enable Editing, don't click Finish, `,`→`;` if rejected, Calculation Automatic.
2. **correct:** follow the README cell list (Table via **Ctrl+T**, formulas filled), **Save As** `*-correct.xlsm`.
3. **typed-values:** Paste Values over the listed range, **Save As** `*-typed-values.xlsm`.
4. **wrong-function** (T only): alternative formula, **Save As** `l01-t-wrong-function.xlsm` (replaces 5.1 files).
5. Upload all to `src/content/levels/01-fondasi/__fixtures__/` via GitHub **Upload files** → commit → tell the agent.

## Open Questions

- Spill formulas (SORT/FILTER) read reliably from Excel cache? Recommendation: check in the spike file too; fall back to SMALL/LARGE/INDEX-based questions if spill cells lack cache.
- Wrong-range Table: partial credit? Recommendation: no — one check, all or nothing, like other checks.
- Does L01-T need a content-version-aware grade for attempts started before the bump? Recommendation: none needed — snapshots carry questions/keys (AD-3); confirm in a test.

## Verification

**Commands:**
- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` -- expected: all pass; golden P2..P5 + L01-T not skipped.

**Manual checks:**
- /levels L01 after five practices: Test unlocked.
