---
title: 'Tracer: Test L01 dan perlengkapan Test'
type: 'feature'
ticket: '1'
created: '2026-11-20'
status: done
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: '4113f4eac261e8a0c46c7d9ea44d499c6d44efb3'
context: ['{project-root}/_bmad-output/specs/spec-excel-practice/content-generation.md', '{project-root}/_bmad-output/specs/spec-excel-practice/level-curriculum.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Belum ada satu pun item Test, jadi tidak ada level yang bisa lulus: gerbang 4.3 hanya terbukti dengan fixture, level v1 tanpa Test tampil "unavailable" tanpa penjelasan, sidebar belum punya hitungan "L-n" / "levels passed of 9", dan Results/History kehilangan judul "Test passed / not passed" bila item Test tidak ada di registry (parked 3.6, 4.1, 4.5).

**Approach:** Tambah item `L01-T` (6–8 soal gabungan keterampilan Level 1, tanpa batas waktu, lulus ≥80) di atas skenario L01 yang ada, dengan fixture Excel 2021 correct / typed-values / wrong-function; jenis item diturunkan dari pola id `LNN-T` (tanpa migrasi); level v1 tanpa Test mendapat kalimat penjelasan; sidebar menampilkan level aktif dan jumlah level lulus dari `levelProgress`.

## Boundaries & Constraints

**Always:**
- `L01-T` memakai `defineLevelModule` (item 6, `kind: "test"`), bank skenario L01 yang ada (≥10 skenario, R4), data acak per attempt (R1), kunci dihitung program (R2), instruksi hanya merujuk kolom/entitas yang ada (R3), total 100 poin (R5), hanya fungsi Office 2021 (R6), teks Indonesia santai + nama Excel Inggris, domain manufaktur (R7).
- Jatah hint Level 1 = 3, −5 per hint; setiap soal punya Tip.
- Jenis item Test = id cocok `^L\d{2}-T$` (sudah dipaksa `defineLevelModule`); berlaku juga saat item hilang dari registry.
- Hitungan sidebar dihitung dari attempt graded lewat `levelProgress` (AD-7, tidak disimpan).
- Tes gerbang L01 memakai `L01-T` asli dari registry, bukan fixture.

**Never:**
- Migrasi DB atau kolom `kind` baru; mengubah grader atau checker (pemeriksa Table/Sort-Filter = 5.2); L01-P2..P5; Level 2–4; perbaikan `normalizeFormula` / `_xludf.` / `t="str"`.
- Batas waktu Test; aturan lulus selain `isPassingScore`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fixture correct | `l01-t-correct.xlsm` | 100, semua soal benar | — |
| Fixture typed-values | nilai ditempel di satu kolom rumus | <100, alasan "nilai yang diketik, bukan rumus" | — |
| Fixture wrong-function | rumus hasil sama, fungsi lain | <100, alasan "tidak memakai fungsi …" | — |
| Data beda | dua attempt `L01-T` berturut-turut | data berbeda, kunci = hitung ulang | — |
| Gerbang asli | registry L01 hanya punya P1 + T | Test terkunci "k to go" sampai 5 latihan berbeda selesai | Start ditolak `test_locked` |
| Lulus | Test graded 80 | L01 passed; sidebar "1 of 9 levels passed"; L02 Under Construction | — |
| Gagal | Test graded 79 | "Try the Test again"; sidebar 0 of 9 | — |
| Item hilang | Result `L03-T` tanpa item di registry | judul "Test passed — …" / "Test not passed — …" tetap | label level dari id |
| Level v1 tanpa Test | registry tanpa `LNN-T` untuk level v1 | Test "unavailable" + kalimat penjelasan | — |
| User baru | tanpa attempt | sidebar "L1", "0 of 9 levels passed" | — |

</frozen-after-approval>

## Code Map

- `src/content/levels/01-fondasi/index.ts`, `practice-1.ts`, `scenarios.ts` -- module, P1 pattern (questions, hints, Tips), scenario bank.
- `src/content/levels/01-fondasi/__fixtures__/` (`README.md`, `l01-p1.ts`, `golden.test.ts`) -- fixture builder + Excel workflow + golden tests to mirror.
- `src/core/content/level-module.ts` -- `defineLevelModule`, `ITEM_ID_RE`, Test = item 6 `LNN-T`, `itemLabel`.
- `src/core/grading/checkers.ts` -- cell / formula / value checks available to L01-T.
- `src/core/progress/level-progress.ts` -- `levelProgress`, `testAttempted`, `canStart`, `PRACTICES_FOR_TEST`.
- `src/components/results/outcome.ts`, `src/app/(app)/history/history-rows.ts`, `history/[attemptId]/page.tsx`, `exam/[attemptId]/page.tsx` -- item kind via `findItem` today.
- `src/app/(app)/levels/level-panel.ts`, `level-detail-panel.tsx` -- Test "unavailable" state.
- `src/components/shell/sidebar-content.tsx`, `nav-items.ts`, shell layout -- Level Map item and footer placeholders.

## Tasks & Acceptance

**Execution:**
- [x] `src/content/levels/01-fondasi/test.ts` (+`test.test.ts`) -- `L01-T`: 6–8 questions mixing `$` absolute/mixed refs, fill-down/right, and Sort/Filter-style results via formulas over the existing scenario data; points sum 100; hints + Tips per question -- the first real Test.
- [x] `src/content/levels/01-fondasi/index.ts` -- add `test` to `items`, bump `contentVersion` -- registers the Test.
- [x] `src/content/levels/01-fondasi/__fixtures__/l01-t.ts`, `README.md` -- `buildFixture` for L01-T blank file + Excel steps section (below) + expected score table -- hitl workflow.
- [x] `src/content/levels/01-fondasi/golden.test.ts` -- golden tests for the three `l01-t-*.xlsm` fixtures (R8).
- [x] `src/core/content/level-module.ts` (+test) -- export `kindFromItemId(id)` (`test` for `LNN-T`, `practice` for `LNN-Pn`, else `null`) -- kind without registry or migration.
- [x] `src/components/results/outcome.ts`, history rows/detail, exam page -- fall back to `kindFromItemId` when `findItem` is `null` -- keeps Test headings for removed items.
- [x] `src/app/(app)/levels/level-panel.ts`, `level-detail-panel.tsx` -- copy for v1 level without Test (e.g. "The Test for this level isn't ready yet.") -- parked 4.1.
- [x] `src/components/shell/sidebar-content.tsx` (+ shell layout passing data) -- Level Map item badge "L{active level}" and footer "{passed} of 9 levels passed" from `levelProgress` -- parked 4.5.
- [x] `src/core/progress/level-progress.test.ts`, `src/app/(app)/levels/start-actions.gate.test.ts` -- gate tests with real `L01-T` (locked until 5 practices; registry has only P1 → stays locked with "4 to go") -- verify line.
- [x] `src/components/shell/*.dom.test.tsx` -- sidebar count DOM test (0, 1 passed; active level).

**Acceptance Criteria:**
- Given the three L01-T fixtures, when golden tests run in CI, then each gets its expected score and reasons.
- Given a stored Result for an item id `LNN-T` not in the registry, when Results or History render, then the heading says "Test passed" / "Test not passed".
- Given any user, when the sidebar renders, then it shows the active level and "n of 9 levels passed" matching `levelProgress`.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- L01-T (`test.ts`, export `levelTest`): 6 questions 15/15/15/20/20/15 — H Unit Baik `=E2-F2`, I Selisih Target `=H2-$N$2`, J Porsi `=H2/SUM($H$2:$H$n)`, K Peringkat `=RANK.EQ(H2,$H$2:$H$n)` (formula form of Sort), R2:U{p+1} grid `=$Q2*(1+R$1)`, N4 `=MAX(H2:H{n})`; target N2 = mean Unit Baik rounded to tens. Tips: four shared with P1 (same ids) + `l01-urutan-tanpa-sort`, `l01-autosum-cepat`. `contentVersion` 2 → 3.
- Deviation: template v1 contract allowed at most 4 questions (`INSTRUCTIONS_CELLS.lines` B6:B10). Extended to B6:B12 (`MAX_QUESTIONS` 6, Finish line B12); B11:B12 are plain (unwrapped) cells in template v1, the template file and VBA are unchanged. Result/snapshot schemas follow the constant (only loosened).
- Kind without registry: `itemFromId` / `kindFromItemId` in `level-module.ts`; `itemView(itemId)` in `src/content/levels/index.ts` falls back to the id + `CURRICULUM` name, used by Results, History (list + detail), Exam.
- Sidebar: `curriculumSummary(progress)` in core; `(app)/layout.tsx` calls `loadProgress()` and passes it to AppSidebar and HeaderBar → MobileDrawer → SidebarContent (badge "L{n}", footer "{n} of 9 levels passed" + progressbar; hidden when progress fails). Adds one progress read per signed-in page render (not cached across the page's own read).
- Review fixes: exam-status calls `router.refresh()` after `router.replace(results)` so the shared layout's sidebar count follows the grade (grading runs in API routes with no client to revalidate, so no `revalidatePath` there); `loadGradedAttempts` wrapped in React `cache()` (layout + page share one read per request); layout uses `loadCurriculumSummary()` (try/catch → `null`, logs `progress.load_failed`); P1 golden asserts `fondasi.contentVersion`.
- Real-L01-T progress tests live in `01-fondasi/test.test.ts` (lint AD-1 forbids core tests importing content); gate tests with the real registry in `start-actions.gate.test.ts`.
- Fixtures: code-built `blank/correct/typed-values/wrong-function` variants run now; the Excel 2021 suite `describe.skipIf` until `l01-t-{correct,typed-values,wrong-function}.xlsm` exist (reason in the suite name + console warning). Blank file built to the scratchpad, not committed. Wrong-function = N4 `=LARGE(H2:H13,1)` (85); typed-values = H2:H13 pasted as values (85).

## Plan Change Log

## Review Triage Log

One combined reviewer (bugs/edge cases, verification, intent); L01-T keys, points (100) and hints verified across scenarios × seeds.

- Fixed (high): sidebar count stayed stale after grading (shared layout not re-rendered on client navigation); exam-status calls `router.refresh()` after `router.replace(results)`.
- Fixed: attempts read twice per request; `loadGradedAttempts` wrapped in React `cache()`.
- Fixed: a throw in the layout's progress derivation could break every page; `loadCurriculumSummary()` catches and hides the summary.
- Fixed: P1 golden test asserts `fondasi.contentVersion` instead of a hard-coded number.
- Accepted: template B11:B12 prompt lines are unwrapped (still readable; style in a later template version).
- Done (hitl): L01-T Excel 2021 fixtures committed by the user (wrong-function re-saved from the correct file); golden tests pass (correct 100, typed-values 85, wrong-function 85).

## Design Notes

- No migration: `attempts.item_id` already encodes kind; `ITEM_ID_RE` + `defineLevelModule` guarantee `LNN-T` ↔ `kind: "test"`, so derivation is total for every id the app can create.
- [ASSUMPTION] L01-T uses only existing checkers; the Excel Table question joins L01-T in 5.2 when the Table checker exists (content version bump).
- [ASSUMPTION] Until L01-P2..P5 land (5.2), L01-T is unreachable in Production (gate needs 5 distinct practices); 5.1 evidence is golden + gate tests, Production play via 4.7 after 5.2 or via the gate test.
- [ASSUMPTION] Sidebar "L-n" = number of the active level (last passed when none active, e.g. after V1 end); footer counts passed levels over all 9.
- [ASSUMPTION] Penjelasan level tanpa Test is a single muted line in the panel; no new component.

**User steps — L01-T fixtures (hitl, ~20 min):** the agent sends `l01-t-blank.xlsm` (`buildFixture("blank")`, fixed seed/scenario) in chat with an exact cell list and expected displayed values per question, written into `README.md` like L01-P1.
1. Save anywhere, open in Excel 2021; **Enable Editing** if Protected View; ignore **Enable Content**; **do not click Finish**.
2. If Excel rejects a formula, replace `,` with `;`; decimal comma display is fine.
3. **correct:** type each listed formula in its top cell, fill with **Ctrl+D**/**Ctrl+R** over the listed range, check the shown value; **Calculation Options = Automatic**; **Save As** `Excel Macro-Enabled Workbook (*.xlsm)` → `l01-t-correct.xlsm`.
4. **typed-values:** in the same file select the listed range → **Ctrl+C** → **Paste Values** → Esc; formula bar shows a number; **Save As** `l01-t-typed-values.xlsm`; close.
5. **wrong-function:** open `l01-t-correct.xlsm`, type the listed alternative formula (same result, different function), fill, **Save As** `l01-t-wrong-function.xlsm`; close.
6. Change nothing else (no headers, sort/filter, sheets, inserted rows/columns).
7. GitHub → repo → the working branch → `src/content/levels/01-fondasi/__fixtures__/` → **Add file → Upload files** → the three files → **Commit directly** → tell the agent.

## Open Questions

- Real "Sort & Filter" in a Test before 5.2? Recommendation: formula results only now (e.g. a ranked/conditional column), structural Table check added in 5.2.
- Exact question count? Recommendation: 6 questions (mostly 15–20 points) to keep the Excel fixture session short.
- Should the sidebar footer appear before any level can pass? Recommendation: yes, "0 of 9 levels passed" — it is accurate and matches EXPERIENCE.md.
- Production proof timing: 4.7 runs after 5.1 but L01-T is gated behind P2..P5. Recommendation: 4.7 checks sidebar/headings now; Test play-through is checked after 5.2.

## Verification

**Commands:**
- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` -- expected: all pass, golden L01-T tests not skipped once fixtures are committed.

**Manual checks:**
- /levels L01: Test shows "locked … 4 to go"; sidebar shows "L1" and "0 of 9 levels passed".
