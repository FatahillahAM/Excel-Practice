---
title: 'Konten Level 1 Practice 1'
type: 'feature'
ticket: '8'
created: '2026-11-04'
status: 'in-review'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: 'e4d5d1eb71aeb27a20b88bdc64493b928f3b5c26'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L01-P1 masih data tetap tracer (`examCells()`, satu prompt SUMIFS yang bukan materi Fondasi): setiap Start memberi file yang sama, belum ada bank skenario, soal berpoin, kunci, maupun snapshot percobaan, jadi CAP-6 gagal dan epic 3 tidak punya apa pun untuk dinilai.

**Approach:** `LevelModule` mendapat bank skenario (≥10), `contentVersion`, dan per item `generate(seed, scenario)` → sel Instructions + Data, soal (poin, sel jawaban, check bernama dari daftar core), dan kunci; semuanya divalidasi zod saat load. Fondasi P1 melatih referensi `$` pada tabel batch produksi. Start mengundi seed dan skenario, memvalidasi hasil, menulis sel ke template, dan menyimpan snapshot (AD-3) di baris percobaan.

## Boundaries & Constraints

**Always:**
- `generate` murni dan deterministik: PRNG ber-seed di core, tanpa `Math.random`, jam, atau IO; seed sama + skenario sama = output sama byte demi byte.
- Validasi saat load (`defineLevelModule`): ≥10 skenario dengan id unik, setiap skenario lolos skema skenario level, dan `generate` dijalankan sekali per (item, skenario) lalu lolos `generatedExamSchema`: poin bulat > 0 berjumlah 100, nomor soal 1…n (n ≤ 5), kunci menutup tepat setiap sel rentang jawaban, sel jawaban tidak ditulis, setiap soal punya `value_equals_key`, tanpa nama fungsi khusus M365 (`level-curriculum.md`) di Instructions, prompt, `uses_functions`, dan `functions` level.
- Sel Instructions hanya layout template v1: B2 judul, B4 skenario, B6:B10 perintah; Data mulai A1. Tanpa rebuild template.
- Check hanya dideklarasikan (nama + parameter, AD-3); implementasinya milik epic 3.
- Teks Indonesia santai (*kamu*), nama fungsi/menu/shortcut Excel persis bahasa Inggris, prompt menyebut sel/rentang tepat dan hanya kolom yang ada di Data.

**Never:**
- `grade()`, checker, Results, hint, Tips (epic 3); Practice 2–5 dan Test (epic 5); layout template baru.
- Tabel konten di DB (AD-10); percabangan engine pada id level (AD-2); skor bergantung pada teks AI.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Start | L01-P1, seed acak, skenario acak | `.xlsm` dengan Instructions skenario itu + Data batch; baris `attempts` punya snapshot `{contentVersion, scenarioId, seed, questions}` | — |
| Seed beda | skenario sama, seed 1 vs 2 | sel Data berbeda, kunci ikut berbeda | — |
| Seed sama | dipanggil dua kali | output identik | — |
| Modul cacat | poin 95, 9 skenario, id skenario kembar, `LAMBDA` di prompt, kunci kurang satu sel, sel jawaban terisi | `defineLevelModule` melempar (gagal saat import/tes) | — |
| Output cacat saat Start | `generate` menghasilkan output di luar skema | `startFailed`, log `attempt.start_invalid_exam`, tanpa baris | — |
| Unduh ulang | Download again | byte tersimpan yang sama (tidak generate ulang) | — |
| Percobaan tracer | baris lama tanpa snapshot | tetap terbaca; `snapshot` null | epic 3 tidak menilainya |

</frozen-after-approval>

## Code Map

- `src/core/content/level-module.ts` -- `LevelItem.examCells()`, `examCellsSchema`, `levelModuleSchema`, `defineLevelModule`. Entry 2.6 (in progress in parallel) adds required `functions: readonly string[]` to `LevelModule` and its schema; rebase on it, keep it, and include it in the M365 check.
- `src/content/levels/01-fondasi/{index,practice-1}.ts` -- tracer data; 2.6 adds `functions: ["$ references", "Excel Table (Ctrl+T)", "Sort & Filter"]` to `index.ts`. `practice-1.ts` exports `ANSWER_SHEET`/`ANSWER_REF` (used only by tests).
- `src/content/levels/index.test.ts` -- registry/schema tests; 2.6 adds `functions` cases there too.
- `src/app/(app)/levels/start-actions.ts` (+test) -- Start pipeline: `findItem` → `examCells()` → `examCellsSchema` → `generateExamWorkbook({cells})` → `createAttempt` → upload. Test spies `examCells`. If 2.6's `level-panel.ts` reads `examCells` to tell items with content, switch it to `generate`.
- `src/adapters/workbook/{generate,template-patch}.ts` -- writes string/number cells by sheet + A1; no formulas. Unchanged.
- `assets/templates/README.md` -- layout v1 (B2, B4, B6:B10, Data from A1; B4/B6:B10 wrap text, column B width 80).
- `src/adapters/supabase/attempts.ts` -- `createAttempt` inserts `item_id, token_sha256, template_version`.
- `supabase/migrations/20261102000001_attempts.sql`, `supabase/tests/contract.db.test.ts` -- column-level insert grant for `authenticated`; contract test asserts other columns are refused (42501).

## Tasks & Acceptance

**Execution:**
- [ ] `src/core/content/random.ts` (+test) -- `createRandom(seed: uint32)` (mulberry32): `next()`, `int(min, max)`, `pick`, `shuffle`; golden sequence test.
- [ ] `src/core/content/checks.ts` (+test) -- `CHECKERS`: `formula_present`, `not_hard_coded`, `value_equals_key {tolerance}`, `uses_functions {functions}`, `uses_reference {ref}`; discriminated-union zod `checkSchema`; `M365_ONLY_FUNCTIONS` (LAMBDA, TEXTSPLIT, VSTACK, HSTACK, TAKE, DROP, GROUPBY, PIVOTBY) + `findM365Functions(text)` (uppercase whole word).
- [ ] `src/core/content/level-module.ts` -- replace `examCells()` with `generate(seed, scenario): GeneratedExam`; add `Scenario` base (`id` kebab, `title`, `story`), `LevelModule.scenarios`, `scenarioSchema`, `contentVersion`; `ExamQuestion {number, prompt, points, sheet, range, checks, key}`; `generatedExamSchema`, `examSnapshotSchema`, `INSTRUCTIONS_CELLS`; load-time rules of Boundaries. Keep 2.6's `functions`.
- [ ] `src/content/levels/01-fondasi/scenarios.ts` -- ≥10 production scenarios (different plants/products), each: company, story, lines (2–4), shifts (2–3), products (3–5, unit-volume and cost ranges), overhead-rate range; level `scenarioSchema`.
- [ ] `src/content/levels/01-fondasi/practice-1.ts` -- `generate` per Design Notes; drop `examCells`, `ANSWER_*`.
- [ ] `src/content/levels/01-fondasi/index.ts` -- `contentVersion: 1`, `scenarios`, `scenarioSchema`.
- [ ] `src/content/levels/index.test.ts` -- module valid; ≥10 scenarios; for every scenario × seeds 1…50: output valid, key recomputed independently from Data cells equals `key`, prompts only name header labels present in row 1; seeds 1 vs 2 differ; same seed identical; matrix rows "Modul cacat" each rejected.
- [ ] `supabase/migrations/20261104000001_attempts_snapshot.sql` + `supabase/tests/contract.db.test.ts` -- `snapshot jsonb` nullable, `check (snapshot is null or jsonb_typeof(snapshot) = 'object')`, `grant insert (snapshot)` to `authenticated`; no select or update grant on `snapshot` — `authenticated` today has a table-level `select`, so revoke it and grant `select` on every existing column instead (the key stays out of the session's reach; the grader reads it with the service role). `createAttempt` must not select `snapshot` back. Tests: insert with snapshot ok; select and update of `snapshot` refused (42501); service role reads it.
- [ ] `src/adapters/supabase/attempts.ts` (+test) -- `createAttempt` takes and inserts `snapshot`.
- [ ] `src/app/(app)/levels/start-actions.ts` (+test) -- `seed = randomInt(2**32)`, scenario = `level.scenarios[randomInt(n)]` (`node:crypto`); `generate` → `generatedExamSchema.safeParse` (fail → `startFailed`, `attempt.start_invalid_exam`) → `generateExamWorkbook({cells})` → `createAttempt({…, snapshot})`; log `scenarioId` and `contentVersion`, never the key. Tests: snapshot passed through, invalid output → no insert.

**Acceptance Criteria:**
- Given two Starts of L01-P1, when both files are opened in Excel 2021, then each opens on Instructions with its scenario's title, story and four prompts plus the Finish line readable (wrapped, no clipped text), Data holds different numbers, and the answer cells are empty.
- Given `npm run test`, when the content tests run, then every scenario × 50 seeds yields a valid exam whose key matches an independent recomputation.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).

## Plan Change Log

## Review Triage Log

## Design Notes

- [ASSUMPTION] Practice 1 trains `$` references only; Excel Table and Sort & Filter go to later Fondasi practices. WorkbookReading (AD-4) sees formulas and values, not ListObjects or filter state, so only `$` is gradable now.
- [ASSUMPTION] Domain = production batches (one generator schema, column headers fixed: Kode Batch, Lini, Shift, Produk, Unit Diproduksi, Unit Cacat, Biaya per Unit); scenarios vary company, products, lines, shifts and ranges. Maintenance, kaizen, time study and warehouse fit later items.
- [ASSUMPTION] Scenarios at level, `generate` per item: AD-2 lists both on the module; "≥10 per level" is shared by its 6 items.
- [ASSUMPTION] Seed and scenario: two independent `crypto.randomInt` draws at Start (uniform; no avoid-last rule). Seed is a uint32 so it fits JSON exactly.
- [ASSUMPTION] Snapshot stored now, in one `attempts.snapshot jsonb` written by Start's session insert (AD-3 says "at Start"; otherwise attempts made before epic 3 cannot be graded). The session can insert it but not read or update it (column grants), so the answer key is not reachable with the user's session; only the service role (grading, epic 3) reads it. (Reviewer note 2026-11-04, consistent with the 2.5 AD-9 decision to keep the DB fence tight.)
- Practice 1 layout (row count `n` = 12–20 random; parameter in `Data!K2` label / `L2` value):

  | Soal | Points | Answer | Expected formula (top cell) | Checks |
  |---|---|---|---|---|
  | 1 Total Biaya | 20 | `H2:H{n+1}` | `=E2*G2` | formula_present, not_hard_coded, value |
  | 2 Biaya Overhead | 25 | `I2:I{n+1}` | `=E2*$L$2` | + `uses_reference {ref: "$L$2"}` |
  | 3 Porsi Produksi | 25 | `J2:J{n+1}` | `=E2/SUM($E$2:$E${n+1})` | + `uses_functions [SUM]`, `uses_reference {ref: "$E$2:$E$…"}` |
  | 4 Simulasi kenaikan biaya | 30 | grid `O2:R{p+1}` (products in `N`, base cost, % in `O1:R1`) | `=$N2*(1+O$1)` | + `uses_reference {ref: "$N2"}`, `{ref: "O$1"}` |

  Headers H1–J1 and the grid labels are written by the generator; answer cells stay empty. B6:B9 = prompts "1. …", B10 = Finish line ("Kalau sudah selesai, klik Finish…"). Prompts say what to compute and that the formula must still work when copied down/across; they do not reveal `$` or `F4` (that is a hint/Tip, epic 3).
- `uses_reference.ref` is written as it must appear in the range's top-left cell; the checker shifts it per cell as Excel's fill does (`$` parts fixed), optional sheet prefix allowed. `value_equals_key` tolerance `1e-9 × max(1, |key|)`. Data numbers: integers for units, 2-decimal costs, so keys are exact doubles.
- `INSTRUCTIONS_CELLS` in core is the content↔template v1 contract; a v2 layout changes it with the template.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: clean.
- `npm run test:db` (CI job `db-contract`) -- expected: green with the snapshot migration.

**Manual checks (if no CLI):**
- Preview (`dev`): two Starts of L01-P1 (Abandon between) → both files open in Excel 2021 on Instructions, text correct and wrapped, Data differs; typing the expected formulas gives the key values; Finish still → "File received — grading…"; `attempts.snapshot` holds scenario, seed and four questions.
