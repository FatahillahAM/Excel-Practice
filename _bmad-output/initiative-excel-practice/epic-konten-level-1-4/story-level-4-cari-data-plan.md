---
title: 'Level 4 Cari data, akhir V1, istilah Excel dan aturan Tip dobel'
type: 'feature'
ticket: '5'
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

**Problem:** Level 4 (Cari data) belum ada sehingga V1 tidak punya akhir; istilah Excel di alasan dan Tip tampil sebagai teks Indonesia biasa (tanpa `<code lang="en">`); dan dua soal dengan id Tip sama tampil sebagai dua Tips Card di Results.

**Approach:** Modul `04-cari-data` (VLOOKUP, XLOOKUP, INDEX-MATCH; 5 latihan + Test, ≥10 skenario); lulus L04-T menampilkan akhir V1 ("Level 4 complete! Level 5 is coming soon"); kontrak konten mendapat markup istilah Excel (backtick, mis. `SUMIFS`) yang dirender `<code lang="en">` dengan backfill L01–L04 dan lint; Results menampilkan satu Tips Card per id Tip.

## Boundaries & Constraints

**Always:**
- R1–R8; jatah hint Level 4 = 0 (tanpa tombol hint aktif, Tip tetap); Test 6–8 soal, tanpa batas waktu, lulus ≥80.
- Fixture Excel hanya L04-T dan satu latihan (P2 XLOOKUP); lainnya buatan kode dengan nilai cache.
- Markup dirender aman (tanpa HTML mentah dari konten); lint gagal bila nama fungsi/ref Excel di teks konten tidak dibungkus.
- Tip dobel: satu kartu per id Tip, urutan kemunculan pertama, menyebut semua soal terkait.

**Never:**
- Level 5+ terbuka atau konten Level 5; mengubah gerbang; fungsi M365 (XLOOKUP/XMATCH boleh); migrasi DB.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| XLOOKUP benar | lookup kode part ke tabel master | nilai cocok kunci | — |
| VLOOKUP approximate keliru | tanpa `FALSE` di data tak urut | `wrong_value` | — |
| Kunci tidak ada | soal `if_not_found` | kunci "Tidak ada" sesuai instruksi | — |
| INDEX-MATCH | soal menerima INDEX+MATCH atau XLOOKUP | sesuai daftar any-of soal | — |
| Lulus L04-T | skor ≥80 | "Level 4 complete! Level 5 is coming soon"; tidak ada level baru terbuka; sidebar "4 of 9" | — |
| Istilah Excel | Tip berisi `SUMIFS` dibungkus | dirender `<code lang="en">SUMIFS</code>` | lint menolak yang tak dibungkus |
| Alasan | `missing_function` XLOOKUP | nama fungsi dalam `<code lang="en">` | — |
| Tip dobel | soal 2 & 4 memakai Tip id sama | satu Tips Card | — |
| Konten lama | Result tersimpan sebelum markup | teks tetap terbaca (markup opsional) | — |

</frozen-after-approval>

## Code Map

Depends on 5.4 (and transitively 5.1–5.3; backfill touches all modules). Code Map may shift once 5.4 lands.

- `src/content/levels/0{1,2,3}-*/` -- modules to backfill markup; latest module pattern.
- `src/core/content/level-module.ts` -- content text contract (instructions, hints, Tips).
- `src/core/grading/reasons.ts` -- `REASON_TEMPLATES`, `reasonText`.
- `src/components/results/tips-card.tsx`, `results-details.tsx`, `results-view.tsx` -- Tip rendering, card list.
- `src/components/results/outcome.ts` -- passed-Test outcome copy (V1 end).
- `src/core/progress/level-progress.ts` -- last v1 level / next phase.

## Tasks & Acceptance

**Execution:**
- [ ] `src/core/content/rich-text.ts` (+test) -- parse backtick-delimited Excel terms into segments `{ text, en }`; lint helper for unwrapped function names/refs.
- [ ] `src/components/**/rich-text.tsx` + `tips-card.tsx`, reason rendering -- render `<code lang="en">` segments.
- [ ] `src/core/grading/reasons.ts` -- wrap function/ref placeholders.
- [ ] `src/content/levels/01..03/*` -- backfill markup; `contentVersion` bump only if Instructions sheet text changes.
- [ ] `src/content/levels/04-cari-data/` -- scenarios (≥10), practice-1..5 (P1 VLOOKUP exact, P2 XLOOKUP, P3 XLOOKUP not-found/multi-column, P4 INDEX-MATCH, P5 mixed), test, index, registry.
- [ ] `04-cari-data/__fixtures__/`, `golden.test.ts` -- Excel P2 + T; code others.
- [ ] `src/components/results/results-details.tsx` (+DOM test) -- dedupe Tips by id.
- [ ] `src/components/results/outcome.ts`, level panel (+tests) -- V1-end copy after L04 pass.
- [ ] `src/content/levels/index.test.ts` -- content lint over all modules.

**Acceptance Criteria:**
- Given all L01–L04 content, when the lint test runs, then no Excel term is unwrapped.
- Given a user who passed L01–L04, when /levels renders, then L05+ stay Under Construction and V1-end message shows.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

- [ASSUMPTION] Markup syntax = backticks in content strings (no HTML in content); rendered as `<code lang="en">`.
- [ASSUMPTION] Hint quota Level 4 = 0: hint UI shows none available; Tips still render.
- [ASSUMPTION] Dedupe rule: one Tips Card per Tip id; the 3.9 Tips collection already dedupes.
- [ASSUMPTION] V1-end copy lives in Results/level panel; no new route.

**User steps (hitl, ~25 min):** `l04-p2-blank.xlsm`, `l04-t-blank.xlsm` with README cell lists.
1. Enable Editing; don't click Finish; `,`→`;` if rejected; Calculation Automatic.
2. **correct** → `*-correct.xlsm`; **typed-values** → `*-typed-values.xlsm`; **wrong-function** (T only, VLOOKUP where XLOOKUP required) → `l04-t-wrong-function.xlsm`.
3. Upload to `src/content/levels/04-cari-data/__fixtures__/`, commit, tell the agent.

## Open Questions

- Lint strictness: flag every uppercase token followed by `(` or A1 pattern? Recommendation: yes, with a small allowlist for Indonesian uppercase words.
- Merge or keep separate the Tip-dedupe change from content? Recommendation: keep in this ticket (small, already scoped) but separate commit.
- Should VLOOKUP be accepted where XLOOKUP is taught? Recommendation: accept any lookup that yields correct values except in the question that explicitly teaches XLOOKUP.

## Verification

**Commands:**
- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` -- expected: all pass; L04 golden not skipped.

**Manual checks:**
- Results with a lookup reason: function name rendered as code; duplicate Tip shows once.
