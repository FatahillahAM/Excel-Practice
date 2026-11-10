---
title: 'Lima pemeriksa, alasan, fixture emas, dan tes paritas'
type: 'feature'
ticket: '2'
created: '2026-11-10'
status: 'in-progress'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
baseline_revision: '19a3f73fda02af4fcf2f0fea6ef4912a1f339d74'
context: ['{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Setelah 3.1 hanya `formula_present` dan `value_equals_key` yang jalan; `not_hard_coded`, `uses_functions`, dan `uses_reference` dilewati, jadi rumus dengan fungsi salah atau referensi tanpa `$` tetap dinilai benar (CAP-5, B6). Belum ada fixture emas maupun tes yang membuktikan file yang sama mendapat skor dan alasan identik lewat macro dan upload.

**Approach:** Tokenizer rumus pindah dari `src/adapters/workbook/formula.ts` ke core dan dipakai pembaca maupun pemeriksa. Registry pemeriksa jadi lengkap (lima nama), `value_equals_key` membedakan sel error dan rumus belum dihitung, dan tiap kegagalan punya templat `reasonText` Indonesia (U2). Fixture emas L01-P1 dibuat dalam kode dari template v1 untuk semua pemeriksa dan dinilai lewat kedua route; tiga file simpanan Excel 2021 dari user (`correct`, `typed-values`, `wrong-function`) masuk branch ini sebelum PR dan dinilai lewat jalur yang sama.

## Boundaries & Constraints

**Always:**
- `grade()` tetap murni dan deterministik (AD-1, AD-3); pemeriksa hanya membaca snapshot dan `WorkbookReading`. Urutan pemeriksaan = urutan `checks` yang dideklarasikan; pemeriksaan pertama yang gagal, di sel pertama yang gagal (urutan rentang), memberi alasan.
- Tiap pemeriksa berdiri sendiri: sel kosong → alasan `empty`, nilai diketik → `typed_value`, apa pun urutan deklarasinya.
- `uses_reference`: `ref` berlaku untuk sel kiri-atas rentang dan digeser seperti fill Excel ke sel lain (bagian `$` tetap); cocok bila token referensi sama persis, tanpa prefiks sheet atau dengan prefiks sheet soal itu.
- `reasonText` hanya menyebut sel dan nama fungsi (U2); tidak pernah kunci, nilai yang diharapkan, atau referensi yang diharapkan. Core tidak mengimpor `src/messages`.
- `Result` lama (versi 1, termasuk percobaan Production 3.1) tetap terbaca.
- Macro dan upload dinilai lewat satu `scheduleGrading`; tes paritas memakai byte file yang sama di kedua route dan membandingkan `Result` yang ditulis.
- File Excel user masuk branch ini sebelum PR; tes yang menilainya ditambahkan bersamaan dengan filenya, tidak pernah di-skip.

**Never:**
- Mengubah `assets/templates/exam.v1.xlsm` (SHA dipin `templates.test.ts`) atau migrasi DB.
- Try again, pagar AD-5, penilaian ulang 15 s, harness DOM (3.3); hint dan Tip konten, snapshot v2 (3.4); isi Results (3.6).
- Menerima fungsi khusus Microsoft 365 secara khusus, atau menilai spill/nama terdefinisi sebagai referensi.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Semua benar | L01-P1, rumus diharapkan di sel atas lalu fill (shared formula) | 100, 4 of 4, tanpa alasan | — |
| Variasi sah | `=G2*E2`, `=$L$2*E2`, `=Data!E2*Data!$L$2`, spasi/huruf kecil | benar | — |
| Angka diketik | H2:H13 nilai tanpa rumus | Q1 salah: "Sel H2 berisi nilai yang diketik, bukan rumus." | — |
| Rumus tanpa referensi | `=1159*1123.51` | `not_hard_coded`: "Rumus di H2 hanya berisi angka, tidak merujuk sel." | — |
| Fungsi salah, nilai benar | J2 `=E2/(AVERAGE($E$2:$E$13)*COUNT($E$2:$E$13))` | `uses_functions`: "Rumus di J2 tidak memakai fungsi SUM." | — |
| Referensi tak terkunci, nilai benar | I2 `=E2*L$2` fill down | `uses_reference`: "Rumus di I2 belum memakai referensi sel yang diminta, jadi hasilnya bisa salah saat disalin." | — |
| Geser fill | `$N2` di O2 → `$N3` di O3, `O$1` di O2 → `P$1` di P2 | sel lain dinilai terhadap ref yang digeser | geser keluar sheet → tidak cocok |
| Toleransi angka | nilai beda ≤ `1e-9 × max(1, abs(kunci))` / lebih | benar / "Hasil di {sel} belum sesuai." | — |
| Teks | kunci teks, beda huruf besar atau spasi | salah (persis) | — |
| Sel error | `#DIV/0!`, `#N/A`, `#REF!` | "Rumus di {sel} menghasilkan error." | — |
| Belum dihitung | rumus dengan nilai cache `null` | "Rumus di {sel} belum dihitung oleh Excel." | — |
| Kosong | sel tanpa rumus dan nilai | "Sel {sel} masih kosong." | — |
| Paritas | file sama lewat macro dan upload | `Result` identik (deep equal) | — |

</frozen-after-approval>

## Code Map

- `src/adapters/workbook/formula.ts` (+`formula.test.ts`) -- tokenizer, `normalizeFormula`, `shiftFormula`, `columnLetters/Index`; no imports, so it moves to core as is. Importers: `src/adapters/workbook/read.ts:4`, `scripts/spike-s2.ts:19`.
- `src/core/grading/checkers.ts` -- `Checker`, `AnswerCell`, `isEmptyCell`, `valueMatches` (tolerance and exact text already right), `CHECKER_REGISTRY` (optional entries), `runCheck` returns `null` for a missing checker.
- `src/core/grading/reasons.ts` -- `ReasonKind`, `Reason {kind, ref}`, `REASON_TEMPLATES`, `reasonText`.
- `src/core/grading/grade.ts` -- loops checks, skips `null`; `tipOf` unchanged.
- `src/core/grading/result.ts:17,66` -- `RESULT_VERSION = 1`, `version: z.literal(RESULT_VERSION)`; read by status route, exam page and Results page via `resultSchema`.
- `src/core/grading/__fixtures__/exam.ts` -- synthetic L01-P1-like snapshot; `correctCells` writes `=X<ref>` formulas that will fail `uses_reference`/`uses_functions` once they run.
- `src/core/content/checks.ts` -- check params (`tolerance`, `functions`, `ref` regex) and `KEY_TOLERANCE`; reuse, do not change.
- `src/content/levels/01-fondasi/practice-1.ts` -- L01-P1 checks: Q2 `$L$2`, Q3 `SUM` + `$E$2:$E${n+1}`, Q4 `$N2` + `O$1`. Seed 7 + `baut-sinar-presisi`: 12 batches (rows 2–13), `L2`=129, O1:R1 = 0.04/0.06/0.08/0.1, grid O2:R5; keys H2 1302148.09, I2 149511, J2 ≈ 0.092461, O2 1168.4504, R5 1318.394.
- `src/app/(app)/levels/start-actions.ts:104` -- how a snapshot is built (`contentVersion`, `scenarioId`, `seed`, `questions`) and validated with `examSnapshotSchema`.
- `src/adapters/workbook/generate.ts` -- `generateExamWorkbook({token, serverUrl, cells})` patches template v1; answer cells are left blank.
- `src/app/api/submissions/{macro,upload}/route.test.ts`, `__fixtures__/files.ts` -- mock pattern for `next/server.after`, `@/adapters/supabase/{auth,service,attempts}`; the upload port checks `userId`; macro needs header token = file token.
- `src/adapters/workbook/__fixtures__/README.md` -- precedent for a user-saved Excel fixture procedure.
- deferred-work.md -- both open items (poll-effect DOM test, partial migration) belong to 3.3 / none; nothing to pick up here.

## Tasks & Acceptance

**Execution:**
- [ ] `src/core/grading/formula.ts` + `formula.test.ts` -- `git mv` from `src/adapters/workbook/`; export `tokenize` and a `FormulaToken` type (kind, text, parts); update `read.ts` and `scripts/spike-s2.ts` imports; no shim left in the adapter -- one tokenizer for reading and checking.
- [ ] `src/core/grading/reasons.ts` -- kinds `hard_coded`, `missing_function`, `wrong_reference`, `error_value`, `not_calculated` with the matrix texts; `Reason` gains optional `function`; `reasonText` fills `{ref}` and `{function}`.
- [ ] `src/core/grading/checkers.ts` (+test) -- `notHardCoded` (≥1 token of kind cells/columns/rows/bracket), `usesFunctions` (a `name` token followed by `(` per required name, `_xlfn.` ignored), `usesReference` (expected = `shiftFormula(ref, row−top, col−left)`, `#REF!` never matches; sheet prefix only the question's, case-insensitive); `valueEqualsKey` returns `error_value` for type `error` and `not_calculated` for a formula with `null` value before `wrong_value`; registry typed total `{ [N in CheckName]: Checker<N> }`, `runCheck` never `null`. Unit-test every matrix row and the standalone empty/typed rule per checker.
- [ ] `src/core/grading/grade.ts` (+test) -- drop the skip path; replace the "skips checks" test with first-failing-check order across all five.
- [ ] `src/core/grading/result.ts` (+test) -- `RESULT_VERSION = 2`; schema accepts version 1 or 2 with the same shape (stored 3.1 Results stay valid).
- [ ] `src/core/grading/__fixtures__/exam.ts`, `grade-attempt.test.ts`, `src/app/api/submissions/grading.test.ts` -- `correctCells` writes formulas that pass all five checks; adjust expectations that relied on skipped checks.
- [ ] `src/core/grading/index.ts` -- export the new checkers and formula API.
- [ ] `src/adapters/workbook/__fixtures__/formula-cells.ts` (+test) -- test-only: insert answer cells into a sheet part in column order: `<f>` + cached `<v>`, Excel shared form (`t="shared" ref si`), `t="e"` errors, `<f>` without `<v>` (uncalculated); round-trips through `readWorkbook`.
- [ ] `src/content/levels/01-fondasi/__fixtures__/l01-p1.ts` -- test-only: `FIXTURE_SEED = 7`, `FIXTURE_SCENARIO_ID = 'baut-sinar-presisi'`, fixed token, `serverUrl 'https://example.invalid'`; `fixtureSnapshot()` (start-actions shape, schema-validated); `buildFixture(variant)` from `generateExamWorkbook` + `formula-cells`; variants `blank`, `correct` (shared formulas), `valid-variants`, `typed-values`, `hard-coded`, `wrong-function`, `wrong-reference`, `error`, `not-calculated`, `tolerance`; `EXPECTED[variant]` = score, correctCount, per-question `correct` + exact `reasonText`.
- [ ] `src/content/levels/01-fondasi/golden.test.ts` -- each code-built variant: `readWorkbook` → `grade(fixtureSnapshot(), reading, 0)` equals `EXPECTED`; five checkers each decide at least one variant.
- [ ] `src/app/api/submissions/parity.test.ts` -- per variant, POST the same bytes to macro (header = file's `WHE_AttemptToken`) and upload (session user owns the attempt); in-memory mocks: `storeSubmissionFile` keeps bytes, `downloadSubmissionFile` returns them, `loadForGrading` → `{status:'received', snapshot}`, `changeStatus` captures `{event, result}`; run each `after()` callback; assert both `Result`s deep-equal each other and `EXPECTED`.
- [ ] HITL (after the tasks above are green) -- run `buildFixture('blank')` once to a file outside the repo and send it with SendUserFile; write the procedure below into `src/content/levels/01-fondasi/__fixtures__/README.md`; halt until the three `.xlsm` files are on the branch (`git pull`).
- [ ] Excel fixtures -- add `l01-p1-correct`, `l01-p1-typed-values`, `l01-p1-wrong-function` cases to `golden.test.ts` and `parity.test.ts` with `EXPECTED_EXCEL`, plus a drift guard: Data A1:G13, L2, M2:N5, O1:R1 of each file equal `fixtureSnapshot()`'s generated cells, and each file matches template v1's fingerprint.

**Acceptance Criteria:**
- Given CI (`npm run test`), when the golden and parity suites run, then every code-built variant and all three Excel-saved files grade to their expected score and reasons, identical through macro and upload.
- Given the stored Production Result of attempt `7ee570ef` (version 1), when `resultSchema` parses it, then it is valid and Results still render it.
- Given `src/adapters/workbook/formula.ts`, then it no longer exists and `src/core/grading/formula.ts` is the only tokenizer.

## HITL: tiga file Excel 2021 (langkah user)

Agent mengirim `l01-p1-blank.xlsm` lewat chat. Waktu sekitar 15 menit.

1. Simpan file ke folder mana saja (misalnya `Documents\fixture`). Buka di Excel 2021; bila ada **Protected View**, klik **Enable Editing**. Bar **Enable Content** boleh diabaikan. **Jangan klik Finish.**
2. Bila Excel menolak rumus ("There's a problem with this formula"), ganti setiap `,` dengan `;` lalu ketik ulang. Desimal bisa tampil dengan koma (`0,092461`); itu sama.
3. **File 1 — correct.** Di sheet `Data`, ketik di sel atas lalu salin:
   - H2 `=E2*G2` → Enter → pilih H2:H13 → **Ctrl+D** (H2 tampil 1302148.09).
   - I2 `=E2*$L$2` → pilih I2:I13 → **Ctrl+D** (I2 149511).
   - J2 `=E2/SUM($E$2:$E$13)` → pilih J2:J13 → **Ctrl+D** (J2 ≈ 0.092461).
   - O2 `=$N2*(1+O$1)` → pilih O2:R2 → **Ctrl+R** → pilih O2:R5 → **Ctrl+D** (O2 1168.4504, R5 1318.394).
   - Pastikan **Formulas → Calculation Options = Automatic**. **File → Save As → Browse**, tipe `Excel Macro-Enabled Workbook (*.xlsm)`, nama `l01-p1-correct.xlsm` → Save.
4. **File 2 — typed-values.** Masih di file yang sama: pilih H2:H13 → **Ctrl+C** → **Home → Paste → Paste Values** (ikon 123) → Esc. Klik H2: formula bar menampilkan angka, bukan rumus. Save As `l01-p1-typed-values.xlsm`. Tutup Excel.
5. **File 3 — wrong-function.** Buka `l01-p1-correct.xlsm`. J2 ketik `=E2/(AVERAGE($E$2:$E$13)*COUNT($E$2:$E$13))` → pilih J2:J13 → **Ctrl+D** (J2 tetap ≈ 0.092461). Save As `l01-p1-wrong-function.xlsm`. Tutup Excel.
6. Jangan mengubah yang lain: tanpa judul kolom, tanpa sort/filter, tanpa sheet baru, tanpa menyisipkan baris atau kolom.
7. Di GitHub buka `FatahillahAM/Excel-Practice`, branch `claude/laughing-shannon-vnoryl`, folder `src/content/levels/01-fondasi/__fixtures__/` → **Add file → Upload files** → seret ketiga file → **Commit directly to the claude/laughing-shannon-vnoryl branch** → **Commit changes**. Beri tahu agent.

| File | Skor | Benar | Alasan |
|---|---|---|---|
| `l01-p1-correct.xlsm` | 100 | 4 of 4 | — |
| `l01-p1-typed-values.xlsm` | 80 | 3 of 4 | Q1 "Sel H2 berisi nilai yang diketik, bukan rumus." |
| `l01-p1-wrong-function.xlsm` | 75 | 3 of 4 | Q3 "Rumus di J2 tidak memakai fungsi SUM." |

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).

## Plan Change Log

## Review Triage Log

## Design Notes

- [ASSUMPTION] `not_hard_coded` passes on any cell/range/structured reference; `=E2*1123.51` passes it, and copying it down fails `value_equals_key` on other products. A defined name does not count (V1 content defines none).
- [ASSUMPTION] Reasons never name the expected reference (it is the `$`/F4 hint, entry 4) or the error code (U2 fills only cell and function).
- [ASSUMPTION] Fixture files are prefixed `l01-p1-` because the Level 1 module will hold several items; the spine's `correct.xlsm`/`typed-values.xlsm` names are read per item.
- [ASSUMPTION] Fixtures use live `generate(7, …)`; entry 4 (snapshot v2, `contentVersion` 2) must keep L01-P1's draw order and update `fixtureSnapshot()`, never the `.xlsm` files. The drift guard catches a data change.
- Spilled values read as `formula: null` (typed_value); L01-P1 prompts ask for one formula copied, so this stays.
- Fixed fixture token belongs to no attempt; route lookups are mocked.

## Verification

**Commands:**
- `npm run lint` -- expected: clean, AD-1 rule passes for `src/core/grading/formula.ts`.
- `npx tsc --noEmit` (`npm run typecheck`) -- expected: no errors (total registry type-checks).
- `npm test` -- expected: green, golden + parity suites included, no skipped tests.
- `npm run build` -- expected: succeeds.
- `npm run test:db` -- not required (no migration); run only if a DB file changes.

**Manual checks (if no CLI):**
- `git status` before PR shows the three `l01-p1-*.xlsm` files committed and `exam.v1.xlsm` unchanged.
