---
title: 'Kontrak hint dan Tips, snapshot v2, konten L01-P1'
type: 'feature'
ticket: '4'
created: '2026-11-13'
status: 'built'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: '6ab5e751d8a9e867c18129d039cd43b55e6096c5'
context: ['{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md', '{project-root}/_bmad-output/specs/spec-excel-practice/level-curriculum.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Kontrak `LevelModule` belum punya hint maupun Tip, snapshot percobaan belum menyimpannya, jadi `grade()` selalu menulis `tip: null` dan hint (3.5) tidak punya sumber teks maupun jatah di server (CAP-7, CAP-8, B4, U5).

**Approach:** Tiap soal hasil `generate()` membawa hint berurutan dan satu Tip (`id`, `title`, `body`, `shortcuts`) yang divalidasi zod saat modul dimuat, termasuk larangan fungsi khusus Microsoft 365. Start menulis snapshot v2 (`version: 2`, `hintQuota`, hint dan Tip per soal); `grade()` menyalin Tip dari snapshot ke `Result`. L01-P1 diisi 3 hint dan 1 Tip per soal, `contentVersion` naik ke 2, dan daftar snapshot AD-3 di spine diperbarui. Tanpa migrasi DB (`snapshot` jsonb).

## Boundaries & Constraints

**Always:**
- Validasi saat modul dimuat (`defineLevelModule` → `generatedExamSchema`): tiap soal 1–3 hint (teks Indonesia, berurutan, tidak kosong) dan tepat satu Tip; tidak ada nama fungsi khusus Microsoft 365 di hint, judul, isi, atau shortcut Tip; id Tip kebab-case, unik di satu ujian, dan isi Tip dengan id yang sama identik di semua item × skenario level itu (koleksi Tips 3.9 memakai id).
- Snapshot v2 wajib: `version: 2`, `contentVersion`, `scenarioId`, `seed`, `hintQuota` (dari `LevelModule.hintQuota`), dan per soal `hints` + `tip`. Snapshot tanpa field itu ditolak `examSnapshotSchema` dan percobaannya tidak dinilai (U5: `snapshot_invalid` → `grading_failed`).
- Urutan undian `generate()` L01-P1 tidak berubah: hint dan Tip hanya teks deterministik, tanpa panggilan `random` baru. Kunci fixture emas 3.2 (seed 7) dan tiga file Excel 2021 tetap dinilai identik (skor dan alasan); hanya `contentVersion` (2) dan `tip` di `Result` yang berubah.
- Hint tidak pernah memuat nilai kunci jawaban atau rumus jawaban lengkap; Tip hanya memakai fitur dan shortcut Excel 2021.
- `Result` lama (versi 1 dan 2 dengan `tip: null`) tetap terbaca; bentuk `Result` tidak berubah.
- Hint dan Tip hanya hidup di snapshot (kolom yang tidak bisa dibaca sesi, AD-9); tidak ditulis ke workbook atau dikirim ke browser di tiket ini.

**Never:**
- Tabel `hint_reveals`, RPC `reveal_hint`, Hint Select/Button, rehidrasi hint, `hintsUsed` dari DB (3.5); tampilan Tips di Results (3.6); halaman koleksi Tips & Tricks (3.9); konten Level 1–4 lain (epic 5).
- Migrasi DB atau perubahan `assets/templates/exam.v1.xlsm`; mengubah file Excel fixture; mengubah perintah soal atau sel Instructions/Data L01-P1.
- Menormalkan atau menilai ulang snapshot v1 lama; tes yang di-skip.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Modul sah | `fondasi` dengan konten L01-P1 baru | dimuat; tiap soal 3 hint + 1 Tip | — |
| Hint salah bentuk | soal tanpa hint, 4 hint, hint `""`/spasi, hint bukan string | modul gagal dimuat, pesan menyebut path `questions.N.hints` | throw saat import |
| Tip salah bentuk | Tip hilang, id bukan kebab, `body` kosong, `shortcuts` bukan array, field asing | modul gagal dimuat | throw saat import |
| Fungsi M365 | `TAKE` di hint, `VSTACK` di isi Tip, `LAMBDA` di shortcut | modul gagal dimuat: "Microsoft 365-only function …" | throw saat import |
| Id Tip bentrok | dua soal satu ujian dengan id Tip sama; atau id sama, isi beda antar skenario | modul gagal dimuat | throw saat import |
| Start baru | Start L01-P1 | snapshot `version` 2, `contentVersion` 2, `hintQuota` 3, 4 soal masing-masing 3 hint + Tip | snapshot tak valid → `start_invalid_exam` seperti sekarang |
| Dinilai | percobaan v2 | tiap `Result.questions[n].tip` = Tip snapshot soal itu, benar maupun salah | — |
| Snapshot lama | `snapshot` v1 (tanpa `version`/`hintQuota`/hint/Tip) | tidak dinilai: `grading_failed` (`snapshot_invalid`) | log grading yang ada |
| Fixture emas | seed 7 + `baut-sinar-presisi`, 3 file Excel | skor/alasan sama seperti 3.2; `contentVersion` 2; Tip terisi | — |

</frozen-after-approval>

## Code Map

- `src/core/content/level-module.ts` -- `ExamQuestion`, `ExamSnapshot`, `examQuestionSchema` (`.strict()`: new fields must be declared), `generatedExamSchema` (superRefine with `addM365Issue`), `examSnapshotSchema`, `levelModuleSchema`, `defineLevelModule` (runs `generate(LOAD_CHECK_SEED, scenario)` for every item × scenario: put the cross-exam Tip-id consistency check here). Header comment "Hints and Tips arrive with epic 3" to update.
- `src/core/grading/result.ts:27` -- `tipSchema` `{id, title, body, shortcuts[]}` (3.1 contract); move it to `src/core/content` (result.ts already imports from content; the reverse would be circular) and re-export from `result.ts`/`index.ts` so existing imports keep working. `RESULT_VERSION` stays 2.
- `src/core/content/checks.ts` -- `findM365Functions`; reuse, unchanged.
- `src/core/grading/grade.ts:63` -- `tipOf` cast; becomes `question.tip`.
- `src/core/grading/grade-attempt.ts:118` -- parses `examSnapshotSchema`; failure → `snapshot_invalid` (U5 path, unchanged).
- `src/app/(app)/levels/start-actions.ts:104` -- builds the snapshot (`satisfies ExamSnapshot`); add `version` and `hintQuota: level.hintQuota`.
- `src/content/levels/01-fondasi/practice-1.ts` -- `generate()`; draw order comment at the top of the body; `last`, `gridLast` available for hint text. `index.ts` -- `contentVersion: 1` → 2.
- `src/content/levels/01-fondasi/__fixtures__/l01-p1.ts` -- `generated()`/`fixtureSnapshot()` build the snapshot by hand (add `version`, `hintQuota`); `resultOf` writes `tip: null` → `q.tip`.
- `src/content/levels/01-fondasi/golden.test.ts:51` -- asserts `contentVersion: 1` and the seed-7 keys (the draw-order guard); drift guard on Data cells only.
- `src/app/api/submissions/parity.test.ts`, `grading.test.ts`, `src/core/grading/{grade,grade-attempt}.test.ts`, `src/app/(app)/exam/[attemptId]/retry-flow.test.ts` -- consume `fixtureSnapshot()`/`SNAPSHOT`; expectations with `tip: null` follow the snapshot's Tip.
- `src/core/grading/__fixtures__/exam.ts` -- synthetic `SNAPSHOT`: add `version`, `hintQuota`, `hints`, `tip`.
- `src/content/levels/index.test.ts` -- registry (`contentVersion: 1`), snapshot schema test (`:146`), `defineLevelModule` table with `brokenItem` (`:185`): add the malformed-hint/Tip rows here.
- `src/app/(app)/levels/start-actions.test.ts:140,261,290` -- `contentVersion: 1` expectations.
- `src/app/(app)/results/[attemptId]/page.test.tsx` -- own Result fixtures with `tip: null`; leave (still valid).
- `supabase/migrations/20261104000001_attempts_snapshot.sql` -- `snapshot` only checked as a jsonb object, set once: no migration needed.
- Spine `ARCHITECTURE-SPINE.md:67` (AD-3 snapshot list); AD-2 (`:61`) and AD-10 already name hints and Tips.
- deferred-work.md -- no open item belongs to 3.4 (open ones: partial-migration test, intersection operator, `_xludf.`, `t="str"` empty cache); nothing to pick up.

## Tasks & Acceptance

**Execution:**
- [x] `src/core/content/level-module.ts` -- `tipSchema` here (kebab `id` ≤64, `title` ≤200, `body` ≤2000, `shortcuts` 0–10 strings ≤40, strict) and `hintSchema` (trimmed string 1–500); `MAX_HINTS_PER_QUESTION = 3`; `SNAPSHOT_VERSION = 2`. `ExamQuestion` + `examQuestionSchema` gain `hints: string[]` (1–3) and `tip: Tip`. `generatedExamSchema`: M365 check on every hint, Tip title, body and shortcut; Tip ids unique within the exam. `ExamSnapshot` + `examSnapshotSchema` gain `version: 2` (literal) and `hintQuota` (int ≥ 0). `defineLevelModule`: one id → one Tip content (deep-equal) across every generated item × scenario. Update the header comment.
- [x] `src/core/grading/result.ts`, `index.ts` -- import/re-export `tipSchema`/`Tip` from content; doc comment on `tip` ("from the snapshot; `null` only in Results before 3.4").
- [x] `src/core/grading/grade.ts` (+`grade.test.ts`) -- `tip: question.tip`; drop `tipOf`; test that every question's Tip (correct and wrong) is copied unchanged.
- [x] `src/app/(app)/levels/start-actions.ts` (+test) -- snapshot with `version: SNAPSHOT_VERSION`, `hintQuota: level.hintQuota`; test the written snapshot has `version` 2, `hintQuota` 3, and `hints`/`tip` on all 4 questions; `contentVersion` expectations → 2.
- [x] `src/content/levels/01-fondasi/practice-1.ts` -- four `const` Tips and per-question `hints` exactly as in Design Notes › Content (hints may interpolate `last`/`gridLast`); no new `random` calls; update the file comment (hints/Tips present, prompts still do not reveal `$`/F4).
- [x] `src/content/levels/01-fondasi/index.ts` -- `contentVersion: 2`.
- [x] `src/content/levels/01-fondasi/practice-1.test.ts` (new) -- for every scenario × seeds 1–5: 3 hints and a Tip per question with the four expected ids; no hint contains the top-cell answer formula (normalized, e.g. `E2*$L$2`, `$N2*(1+O$1)`, `SUM($E$2:$E$<last>)` as a whole formula) or any key value (`String(v)` and `v.toFixed(2)`); every Tip has ≥1 shortcut.
- [x] `src/content/levels/index.test.ts` -- registry `contentVersion: 2`; snapshot test adds `version`/`hintQuota` and rejects a snapshot missing `version`, `hintQuota`, a question's `hints` or `tip` (v1 shape); `defineLevelModule` table rows for every I/O matrix error row (no hint, 4 hints, blank hint, Tip missing, bad id, empty body, extra field, `TAKE` in hint, `VSTACK` in body, `LAMBDA` in shortcut, duplicate id in one exam, same id with different content across scenarios).
- [x] `src/core/grading/__fixtures__/exam.ts` + `grade-attempt.test.ts`, `src/app/api/submissions/grading.test.ts`, `src/app/(app)/exam/[attemptId]/retry-flow.test.ts` -- v2 `SNAPSHOT` (`version`, `hintQuota` 3, one hint and a Tip per question); expectations take `tip` from the snapshot; a stored v1 snapshot (current shape) → `snapshot_invalid` → `grading_failed` in `grade-attempt.test.ts`.
- [x] `src/content/levels/01-fondasi/__fixtures__/l01-p1.ts`, `golden.test.ts`, `src/app/api/submissions/parity.test.ts` -- snapshot built with `version`/`hintQuota`; `resultOf` → `tip: q.tip`; golden asserts `contentVersion: 2` and the unchanged seed-7 keys; all code-built variants and the 3 Excel files keep their 3.2 scores and reasons through macro and upload.
- [x] `_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md` -- AD-3 snapshot list: "snapshot version (2), scenario id, seed, `content_version`, the level's `hintQuota`, questions with integer `points` (sum = 100), answer key, ordered hints and one Tip (id, title, body, shortcuts) per question; a snapshot without them is not graded".

**Acceptance Criteria:**
- Given a level whose hint or Tip is malformed or names a Microsoft 365-only function, when the module is imported (`defineLevelModule`), then it throws and the test suite fails.
- Given a Start of L01-P1, when the snapshot is written, then it is v2 with `hintQuota` 3 and 3 hints + 1 Tip on each of the 4 questions, and grading that attempt writes each Tip into `Result.questions[n].tip`.
- Given the 3.2 golden suite, then every variant and Excel file grades to the same score, correct count and reasons as before, with `contentVersion` 2.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `tipSchema` now lives in `src/core/content/level-module.ts` with a kebab-case `id` (≤64); `result.ts` re-exports it, so `Result.questions[n].tip` also requires a kebab id. Stored Results all have `tip: null`, so none becomes unreadable.
- The cross-scenario Tip check in `defineLevelModule` compares id, title, body and shortcuts field by field (`sameTip`), and runs only on exams that already passed `generatedExamSchema`.
- `practice-1.ts` exports `TIPS` (the four constant Tips); each question gets a fresh copy so the `Tip` type (mutable `shortcuts`) holds. No new `random` calls: the seed-7 keys and the drift guard are unchanged.
- Two files outside the Code Map needed the new required fields to type-check: `src/adapters/supabase/attempts.test.ts` (its `writeSnapshot` snapshot literal) and `src/core/grading/checkers.test.ts` (its `question()` helper). Test-only, no behaviour change.
- `src/app/api/submissions/grading.test.ts` also gains a v1-snapshot → `grading.snapshot_invalid` → `grading_failed` case through `runGrading`, next to the one in `grade-attempt.test.ts`. `supabase/tests/contract.db.test.ts` is untouched (its snapshot is an opaque jsonb for the DB contract), so `test:db` was not needed.

## Plan Change Log

- 2026-11-13 (review of 3.4, four lenses): content — Q1 hint 2 is a general hint instead of a click-by-click recipe; Q4 hint 3 no longer writes the required references (`$N2`, `O$1`), explains the F4 cycle on A1 and names the part to lock in words, and fills O2:R2 with Ctrl+R then O2:R{gridLast} with Ctrl+D; Tip `l01-format-persen` uses the prompts' decimal dot (0.25) and says the status bar Sum (Jumlah) shows 100% once the cells are formatted as percent. Design Notes › Content updated to match. `contentVersion` stays 2 (not yet deployed).
- 2026-11-13 (review): `findM365Functions` also matches a call in any case (`take(`, `Vstack(`), still the bare name only in uppercase so prose (`take a break`, `Map the data`) does not match; `M365_ONLY_FUNCTIONS` gains TEXTBEFORE, TEXTAFTER, TOCOL, TOROW, WRAPROWS, WRAPCOLS, CHOOSEROWS, CHOOSECOLS, EXPAND, BYROW, BYCOL, MAP, REDUCE, SCAN, MAKEARRAY, ISOMITTED, IMAGE, REGEXTEST, REGEXEXTRACT, REGEXREPLACE, PERCENTOF, TRIMRANGE (30 names; `level-curriculum.md` › Dilarang still lists the original 8). The same check runs on Instructions, Data, prompts, `uses_functions`, hints and Tips.
- 2026-11-13 (review): `defineLevelModule` generates every item × scenario with `TIP_CHECK_SEEDS` (1–5), validates each exam and compares Tips across all of them, not only seed 1.
- 2026-11-13 (review): Tip shortcuts must match `SHORTCUT_RE` (Excel key names, modifiers `Ctrl`/`Shift`/`Alt`/`Fn` joined with `+` to one key, or one key alone such as `F4`); `ctrl d`, `F4 lalu Enter`, `Ctrl++` are refused.
- 2026-11-13 (review): `hintQuota` is bounded 0–20 (`MAX_HINT_QUOTA`) in both `levelModuleSchema` and `examSnapshotSchema`.
- 2026-11-13 (review): golden expected Results take each Tip from the `TIPS` constants instead of the snapshot under test.

## Review Triage Log

Four lenses (blind-hunter, edge-case-hunter, verification-gap, intent-alignment), 2026-11-13.

| # | Finding | Decision |
|---|---|---|
| 1 | Q1 hint 2 dictates the full formula click by click | patched — general hint |
| 2 | Q4 hint 3 spells out required reference `$N2`; its fill steps (Ctrl+R/Ctrl+D on O2 alone) overwrite the formula | patched — generic F4 cycle, correct block-then-fill steps |
| 3 | Percent Tip uses comma decimal unlike the prompts; status bar shows 100% only once formatted | patched |
| 4 | M365 check case-sensitive and list incomplete (TEXTBEFORE, CHOOSECOLS, …) | patched — calls matched in any case, 30 names |
| 5 | "One Tip id, one content" checked at seed 1 only | patched — seeds 1–5 × scenarios at load |
| 6 | Shortcut format unchecked (`ctrl d`, `Ctrl++`) | patched — `SHORTCUT_RE` |
| 7 | `hintQuota` unbounded; not shown to come from the level | patched — 0..20; start-actions test with quota 2 |
| 8 | Leak test only whole formulas / JS number format; Tips unchecked | patched — required refs verbatim, id-ID/percent formats, Tip bodies |
| 9 | Rejection tests don't assert issue paths; golden Tips copied from the snapshot under test | patched |
| 10 | v1-snapshot attempts fail and loop on Try again | deferred — U5; prod checked for running attempts before merge |
| 11 | Tip-id uniqueness across levels | deferred — 3.9 |
| 12 | `grade()` doesn't compare `hintsUsed` with `hintQuota` | deferred — 3.5 |
| 13 | Hints required while `hintQuota` may be 0 (Ujian Akhir) | deferred |
| 14 | `tipSchema` in Result now requires kebab-case id | accepted — every stored Result has `tip: null` |
| 15 | Q2 hints together reconstruct the formula | accepted — last hint teaches the F4 technique by design; checks still require the formula |

Checks after patches: lint, typecheck, test (61 files, 1169), build pass.

## Design Notes

- [ASSUMPTION] Hints are built in `generate()` (they may name the exam's own range, e.g. `E2:E13`); Tips are fixed constants so one id always means one card (the Tips collection dedupes by id).
- [ASSUMPTION] 3 hints per question (= the Level 1 quota), graded from nudge to method; the last hint names the `$`/F4 technique but never the full formula or a value. The `uses_*` checks still need the student to type it.
- [ASSUMPTION] Explicit `version: 2` in the snapshot (a discriminator for later shapes); `RESULT_VERSION` stays 2 because the `Result` shape does not change (`tip` was already nullable).
- [ASSUMPTION] Shortcut strings use Excel's key names joined with `+` (`Ctrl+Shift+%`); 3.6 renders each key as a `Kbd`.
- No migration: `snapshot` is jsonb (object check only). The deploy order matters only for attempts in flight: an `open`/`received`/`grading_failed` attempt with a v1 snapshot would end `grading_failed` (U5), so the Production check confirms there are none first.

### Content (Indonesian; the user may revise wording before or after approval)

`{last}` = last data row (n+1), `{gridLast}` = last grid row.

**Soal 1 — Total Biaya (H2:H{last})**
1. "Total Biaya cukup dihitung dari dua kolom di baris yang sama: Unit Diproduksi dan Biaya per Unit."
2. "Rumus dimulai dengan = dan merujuk sel di baris yang sama, bukan angka yang diketik."
3. "Kedua referensi memang harus ikut bergeser per baris, jadi tidak perlu tanda $. Setelah H2 benar, blok H2:H{last} lalu tekan Ctrl+D."
- Tip `l01-isi-rumus-sekaligus` · "Isi rumus ke bawah sekaligus" · "Blok sel dari rumus paling atas sampai baris terakhir data, lalu tekan Ctrl+D: rumus di sel atas disalin ke semua sel yang diblok. Cara lain: blok dulu seluruh range, ketik rumusnya, lalu tekan Ctrl+Enter supaya semua sel terisi sekaligus." · `["Ctrl+D", "Ctrl+Enter"]`

**Soal 2 — Biaya Overhead (I2:I{last})**
1. "Tarif overhead hanya ada di satu sel, L2. Kalau rumus disalin ke bawah, referensi biasa ikut bergeser jadi L3, L4, dan seterusnya, padahal tarifnya cuma ada di L2."
2. "Tanda $ mengunci referensi: $ di depan huruf mengunci kolom, $ di depan angka mengunci baris. Referensi yang dikunci tidak bergeser saat disalin."
3. "Di rumus I2, klik referensi tarif overhead lalu tekan F4 sampai kolom dan barisnya sama-sama terkunci. Unit Diproduksi dibiarkan tanpa $ karena harus ikut turun per baris."
- Tip `l01-kunci-sel-f4` · "Kunci sel dengan F4" · "Saat mengetik atau mengedit rumus, taruh kursor di referensi sel lalu tekan F4: A1 menjadi $A$1. Tekan lagi untuk berganti A$1, $A1, lalu kembali A1. Di laptop, mungkin perlu Fn+F4." · `["F4"]`

**Soal 3 — Porsi Produksi (J2:J{last})**
1. "Porsi = unit batch itu dibagi total unit semua batch. Pembilangnya berubah per baris, penyebutnya selalu total yang sama."
2. "Saat rumus disalin ke bawah, range di dalam SUM ikut bergeser kalau tidak dikunci, jadi total di baris bawah tidak lagi mencakup semua batch."
3. "Di dalam SUM, blok range E2:E{last} lalu tekan F4 sekali supaya awal dan akhir range sama-sama terkunci. Unit batch di pembilang tetap tanpa $."
- Tip `l01-format-persen` · "Tampilkan porsi sebagai persen" · "Hasil pembagian seperti 0.25 lebih mudah dibaca sebagai 25%. Blok selnya lalu tekan Ctrl+Shift+%: hanya tampilannya yang berubah, nilainya tetap sama. Untuk cek cepat, blok semua porsi yang sudah diformat persen lalu lihat Sum (Jumlah) di status bar: hasilnya harus 100%." · `["Ctrl+Shift+%"]`

**Soal 4 — Simulasi kenaikan biaya (O2:R{gridLast})**
1. "Setiap sel di O2:R{gridLast} memakai dua angka: Biaya Dasar di kolom N pada baris yang sama, dan persentase kenaikan di baris 1 pada kolom yang sama."
2. "Saat disalin ke kanan, rujukan ke kolom N tidak boleh pindah kolom; saat disalin ke bawah, rujukan ke baris 1 tidak boleh pindah baris. Ini referensi campuran: hanya satu bagian yang dikunci."
3. "Tekan F4 berulang untuk berganti bentuk referensi: A1 → $A$1 → A$1 → $A1. Untuk Biaya Dasar kunci kolomnya saja, untuk persentase kunci barisnya saja. Setelah O2 benar, blok O2:R2 lalu Ctrl+R, kemudian blok O2:R{gridLast} lalu Ctrl+D."
- Tip `l01-referensi-campuran` · "Satu rumus untuk tabel dua arah" · "Di tabel yang dibaca dari judul kiri dan judul atas, kunci kolom untuk judul kiri ($A2) dan baris untuk judul atas (B$1). Tulis rumus di sel pojok kiri atas, blok baris pertama lalu Ctrl+R, kemudian blok seluruh tabel lalu Ctrl+D." · `["F4", "Ctrl+R", "Ctrl+D"]`

## Verification

**Commands:**
- `npm run lint` -- expected: clean.
- `npx tsc --noEmit` -- expected: no errors.
- `npm test` -- expected: green, no skipped tests; golden and parity suites unchanged in score/reasons.
- `npm run build` -- expected: succeeds (the level module loads at build).

**Production check (orchestrator/user, after merge; not hitl):**
- Before the deploy: no migration (`/health` stays `20261110000001`); in `prod` SQL, `select count(*) from public.attempts where status in ('open','received','grading_failed')` = 0 (else Abandon it first: a v1 snapshot will not be graded, U5).
- After the deploy: Start L01-P1 in Production; read-only SQL on that attempt: `snapshot->>'version'` = 2, `snapshot->>'contentVersion'` = 2, `snapshot->>'hintQuota'` = 3, each `snapshot->'questions'->i` has 3 `hints` and `tip->>'id'` in the four ids above. Runtime log `attempt.started` shows `contentVersion` 2.
- Finish → Results appears as in 3.1; `result->'questions'->i->'tip'->>'id'` matches the snapshot for all 4 questions; no `snapshot_invalid` or `attempt.start_invalid_exam` in the logs.
