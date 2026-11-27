---
title: 'Level 2 Logika dan edge case penilaian'
type: 'feature'
ticket: '3'
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

**Problem:** Level 2 (Logika) belum punya modul, dan dua edge case penilaian membuat alasan salah: prefiks `_xludf.` dilaporkan sebagai fungsi hilang (padahal `#NAME?`), dan sel rumus `t="str"` dengan cache kosong dinilai `wrong_value` (padahal belum dihitung).

**Approach:** Modul `02-logika` (IF, IFS, AND/OR, IFERROR; 5 latihan + Test, ≥10 skenario manufaktur) dengan pola L01; `_xludf.` dibuang saat membaca fungsi dan memberi alasan baru `unknown_function` (#NAME?); cache kosong `t="str"` dibaca sebagai belum dihitung → `not_calculated`.

## Boundaries & Constraints

**Always:**
- R1–R8; jatah hint Level 2 = 2 (−5); Tip per soal; Test 6–8 soal gabungan, tanpa batas waktu, lulus ≥80.
- Fixture Excel hanya L02-T dan satu latihan (P1); latihan lain fixture buatan kode dengan nilai cache.
- Perbaikan alasan memakai tes regresi di `checkers.test.ts` / `read.test.ts`; teks alasan Indonesia lewat `REASON_TEMPLATES`.
- Modul terdaftar di `src/content/levels/index.ts`; level 2 berfase v1.

**Never:**
- Fungsi M365 (R6) atau fungsi di luar daftar level (LET boleh di Tip saja bila perlu, bukan kunci).
- Mengubah gerbang/aturan lulus; normalizeFormula (5.4); `<code lang="en">` (5.5); migrasi DB.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| IF benar | `=IF(D2>=Target,"OK","NG")` | nilai cocok kunci | — |
| Nilai diketik | "OK"/"NG" diketik | `typed_value` | — |
| Fungsi lain | IFS dipakai di soal IF wajib | sesuai `uses_functions` soal (boleh/tidak tercantum) | — |
| `_xludf.IFS` | file disimpan Excel lama / fungsi tak dikenal | alasan "Excel tidak mengenali fungsi (#NAME?)" | bukan `missing_function` |
| `t="str"` cache kosong | rumus string, `<v></v>` | `not_calculated` | bukan `wrong_value` |
| `t="str"` cache "" asli | `=IF(A2="","",..)` hasil kosong yang sah dari Excel | `[ASSUMPTION]` tetap dibaca "" bila kunci "" | — |
| IFERROR | pembagian nol di data | kunci memakai nilai pengganti | — |
| Gerbang | 5 latihan L02 + L01 lulus | L02-T terbuka | — |

</frozen-after-approval>

## Code Map

Depends on 5.1 (Test pattern); independent of 5.2 but built after it, so Code Map may shift (new check names, `generate.ts` helpers) once 5.2 lands.

- `src/content/levels/01-fondasi/` -- module, scenarios, practice, test, fixture + golden pattern to copy.
- `src/content/levels/index.ts` (+test) -- registry.
- `src/core/grading/checkers.ts` -- `calledFunctions`, `functionName`, `valueEqualsKey`.
- `src/core/grading/reasons.ts` -- `ReasonKind`, `REASON_TEMPLATES`.
- `src/adapters/workbook/read.ts`, `src/core/grading/workbook-reading.ts` -- `t="str"` handling.

## Tasks & Acceptance

**Execution:**
- [ ] `src/core/grading/checkers.ts`, `reasons.ts` (+tests) -- strip `_xludf.` in `functionName`; any called `_xludf.` function → reason `unknown_function` (#NAME?) before `missing_function`.
- [ ] `src/adapters/workbook/read.ts` (+test) -- formula cell `t="str"` with empty/missing `<v>` → `value: null` (→ `not_calculated`).
- [ ] `src/content/levels/02-logika/scenarios.ts` -- ≥10 manufacturing scenarios (QC pass/NG, downtime, shift, target).
- [ ] `02-logika/practice-1..5.ts` (+tests) -- P1 IF, P2 AND/OR, P3 nested IF/IFS, P4 IFERROR, P5 mixed; 100 points each.
- [ ] `02-logika/test.ts`, `index.ts` -- L02-T 6–8 questions; module registered.
- [ ] `02-logika/__fixtures__/` (`README.md`, builders), `golden.test.ts` -- Excel fixtures P1 + T; code fixtures P2..P5.

**Acceptance Criteria:**
- Given the module, when module validation runs, then every item totals 100, uses only Office 2021 functions, and has ≥10 scenarios.
- Given existing L01 golden fixtures, when grading changes land, then their scores are unchanged.

## Implementation Notes

## Plan Change Log

- 2026-11-27 (implementation): "IF or IFS accepted" is done by declaring no `uses_functions` on those questions (L02-P1 all, L02-P3 Q3, L02-P5 Q2, L02-T Q4), not by a new any-of check; questions that teach AND, OR, IFS, nested IF or IFERROR require that function.
- 2026-11-27: empty `t="str"` cache is read as `value: null, type: "string"`; `value_equals_key` gives `not_calculated`, except where the key is "" (Excel's own "" result passes). No calcChain/app-props test: the L02-P1 Excel fixture (K2) settles whether Excel 2021 writes `<v></v>`.
- 2026-11-27: `unknown_function` is decided in every formula checker (and `spills`) right after the formula-present rule, so it precedes all other checks on that cell; template has no function name (the unknown name may be a declared one, e.g. `_xludf.IFS`).
- 2026-11-27: L02-T has 6 questions (MAX_QUESTIONS), not 6–8; Materi 2–3 cards per Practice (5.7); NOT left out of `functions` (curriculum lists IF, IFS, AND/OR, IFERROR).
- 2026-11-27: registering Level 2 changed two existing expectations: `index.test.ts` (registry now L01 + L02) and `level-path.dom.test.tsx` (new account: Level 2 "locked", not "under_construction").

## Review Triage Log

## Design Notes

- [ASSUMPTION] Hint quota Level 2 = 2, per curriculum 3→2→1→0.
- [ASSUMPTION] Excel never writes `t="str"` with empty `<v>` for a real "" result; if Excel does, distinguish by key: empty key keeps "" → see Open Questions.
- [ASSUMPTION] `unknown_function` is a new ReasonKind; it takes precedence over other checks on that cell.
- [ASSUMPTION] Fixture practice = P1 (IF), simplest Excel session.

**User steps (hitl, ~25 min):** files `l02-p1-blank.xlsm`, `l02-t-blank.xlsm` with README cell lists.
1. Enable Editing; don't click Finish; `,`→`;` if rejected; Calculation Automatic.
2. **correct** → `*-correct.xlsm`; **typed-values** (Paste Values) → `*-typed-values.xlsm`; **wrong-function** (T only) → `l02-t-wrong-function.xlsm`.
3. Change nothing else; upload to `src/content/levels/02-logika/__fixtures__/`, commit, tell the agent.

## Open Questions

- Does Excel 2021 store a legitimately empty string result as `t="str"` + `<v></v>`? Recommendation: add one such question to the L02-P1 fixture; if yes, treat empty cache as `not_calculated` only when the file lacks Excel's `calcChain`/app props, else keep "".
- Should `unknown_function` cost the whole question? Recommendation: yes, same as other failed checks.
- IFS allowed where IF is taught? Recommendation: accept either (list both in `uses_functions` any-of) except the question explicitly teaching nested IF.

## Verification

**Commands:**
- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` -- expected: all pass; L02 golden not skipped.

**Manual checks:**
- /levels L02 after L01 passed: practices startable, Test locked until 5 done.
