---
title: 'Level 3 Hitung bersyarat dan perbaikan operator spasi'
type: 'feature'
ticket: '4'
created: '2026-11-20'
status: 'draft'
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

**Problem:** Level 3 (Hitung bersyarat) belum ada, dan `normalizeFormula` menghapus semua spasi di luar string sehingga operator intersection (`$E$2:$E$13 $E:$E`) menggabung dua referensi dan `uses_reference` menggagalkan rumus yang sah.

**Approach:** Modul `03-hitung-bersyarat` (COUNTIFS, SUMIFS, AVERAGEIFS, MAXIFS/MINIFS; 5 latihan + Test, ≥10 skenario) dengan pola L01/L02; `normalizeFormula` mempertahankan satu spasi bila spasi itu berada di antara dua token referensi (operator intersection), spasi lain tetap dibuang.

## Boundaries & Constraints

**Always:**
- R1–R8; jatah hint Level 3 = 1 (−5); Tip per soal; Test 6–8 soal, tanpa batas waktu, lulus ≥80.
- Fixture Excel hanya L03-T dan satu latihan (P2 SUMIFS); lainnya buatan kode dengan nilai cache.
- Perbaikan formula dibuktikan dengan tes tokenizer/normalizer dan regresi semua golden yang ada (L01, L02).

**Never:**
- Mengubah arti rumus lain (spasi setelah fungsi, di sekitar operator aritmetika, di dalam string); menambah pemahaman intersection ke penilaian nilai.
- SUMPRODUCT/array trik sebagai kunci wajib; fungsi M365; migrasi DB.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Intersection | `=SUM($E$2:$E$13 $E:$E)` | dua referensi terpisah; `uses_reference` `$E$2:$E$13` lulus | — |
| Spasi biasa | `=SUMIFS( D:D , B:B ,"A")` | dinormalisasi tanpa spasi seperti sekarang | — |
| Spasi dalam string | `"Line A"` | tidak berubah | — |
| Nama + referensi | `=Data!A1 B1` | intersection dikenali | — |
| SUMIFS benar | kriteria dari sel | nilai cocok kunci | — |
| Kriteria diketik | `"Line A"` diketik padahal soal minta sel | `wrong_reference` bila soal mewajibkan referensi | — |
| MAXIFS tanpa baris cocok | data acak tanpa kecocokan | generator menghindari (kunci 0 tidak ambigu) | seed diulang |
| AVERAGEIFS div/0 | tanpa kecocokan | generator menjamin ≥1 baris cocok | — |

</frozen-after-approval>

## Code Map

Depends on 5.3 (module pattern with new reasons, `_xludf.` handling). Code Map may shift once 5.3 lands.

- `src/core/grading/formula.ts` (+`formula.test.ts`) -- `normalizeFormula`, `tokenize` (space tokens).
- `src/core/grading/checkers.ts` -- `hasReference`, `significantTokens`.
- `src/content/levels/02-logika/` -- latest module pattern.
- `src/content/levels/index.ts` -- registry.

## Tasks & Acceptance

**Execution:**
- [ ] `src/core/grading/formula.ts` (+tests for matrix rows 1–4) -- keep a single space between two reference-like tokens (cells/columns/rows/name/quoted sheet ref, closing paren) as the intersection operator.
- [ ] `src/core/grading/checkers.test.ts` -- `uses_reference` passes with intersection.
- [ ] `src/content/levels/03-hitung-bersyarat/scenarios.ts` -- ≥10 scenarios (output per line/shift/product, reject counts, downtime).
- [ ] `03-hitung-bersyarat/practice-1..5.ts` (+tests) -- P1 COUNTIFS, P2 SUMIFS, P3 AVERAGEIFS, P4 MAXIFS/MINIFS, P5 mixed with criteria cells + `$`.
- [ ] `03-hitung-bersyarat/test.ts`, `index.ts`, registry -- L03-T.
- [ ] `03-hitung-bersyarat/__fixtures__/`, `golden.test.ts` -- Excel fixtures P2 + T; code fixtures others.

**Acceptance Criteria:**
- Given the module, when module validation runs, then every item totals 100, Office 2021 only, ≥10 scenarios.
- Given all previous golden fixtures, when the normalizer changes, then scores are unchanged.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

- [ASSUMPTION] Hint quota Level 3 = 1.
- [ASSUMPTION] COUNTIF/SUMIF (single criteria) are accepted where the question has one criterion, but taught forms are the -IFS family.
- [ASSUMPTION] Intersection fix lives in normalization only; no checker evaluates intersections.

**User steps (hitl, ~25 min):** `l03-p2-blank.xlsm`, `l03-t-blank.xlsm` with README cell lists.
1. Enable Editing; don't click Finish; `,`→`;` if rejected; Calculation Automatic.
2. **correct** → `*-correct.xlsm`; **typed-values** → `*-typed-values.xlsm`; **wrong-function** (T only, e.g. SUMPRODUCT instead of SUMIFS) → `l03-t-wrong-function.xlsm`.
3. Upload to `src/content/levels/03-hitung-bersyarat/__fixtures__/`, commit, tell the agent.

## Open Questions

- Accept SUMIF/COUNTIF where one criterion suffices? Recommendation: yes (any-of), to avoid punishing a valid answer.
- Accept whole-column refs (`B:B`) vs bounded ranges? Recommendation: accept both via value check; require `$` only when filling is part of the question.

## Verification

**Commands:**
- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` -- expected: all pass; L03 golden not skipped.
