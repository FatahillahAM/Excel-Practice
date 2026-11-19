---
title: 'Koleksi Tips & Tricks'
type: 'feature'
ticket: '9'
created: '2026-11-18'
status: done
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: '6c526f493b934b306e89f1867fda6cd33a86a277'
context: ['{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/DESIGN.md', '{project-root}/_bmad-output/initiative-excel-practice/epic-penilaian-hasil-tips/story-history-plan.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/tips` masih placeholder, jadi Tips yang sudah tampil di Results hilang setelah layar ditutup; CAP-8 meminta setiap kartu yang pernah tampil masuk koleksi yang bisa difilter per level dan dicari.

**Approach:** Fungsi murni `tipsCollection()` di `src/core/progress` menurunkan koleksi dari `Result` tersimpan (AD-7, tanpa tabel baru), unik per id Tip. Halaman `/tips` membaca semua percobaan `graded`/`closed` milik user lewat adapter sesi (pola `listGradedResults` dari 3.8, tanpa batas 50), lalu menampilkan Tips Card (3.6) dengan filter level, pencarian, keadaan kosong, dan pesan tanpa hasil. Tanpa migrasi DB dan tanpa dependensi baru.

## Boundaries & Constraints

**Always:**
- Sumber hanya percobaan `graded`/`closed` dengan `result` non-null yang lolos `resultSchema` (U6); yang tidak valid dilewati dan dicatat (`tips.result_invalid`, tanpa isi). Soal dengan `tip: null` (Result v1) tidak menyumbang kartu.
- Koleksi mencakup semua percobaan yang dinilai, bukan hanya 50 terbaru.
- Satu kartu per id Tip. Bila id yang sama muncul dengan isi berbeda, isi dari percobaan terbaru (`started_at desc, id desc`) yang dipakai. Level kartu = level item percobaan terbaru itu (`findItem`); item tak dikenal → tanpa level.
- `tipsCollection` murni: tanpa I/O, tanpa jam, tanpa `src/messages`; menerima baris (itemId, startedAt, Result) dan pemeta level.
- Dibaca lewat sesi user (AD-9), RLS + `user_id = userId`; hanya kolom yang sudah di-grant ke `authenticated`.
- Filter level: "All levels" + level yang punya kartu. Pencarian di judul, isi, dan shortcut; tidak peka huruf besar/kecil (`id-ID`) dan mengabaikan spasi di awal/akhir. Filter dan pencarian bekerja bersama (AND).
- Kosong (belum ada Tips): satu baris pesan + tautan ke Dashboard. Tanpa hasil filter/pencarian: satu baris pesan (mis. "Belum ada Tips untuk Level 3 — selesaikan latihan dulu, ya.") + tombol hapus filter. Memuat: Skeleton berbentuk grid kartu. Gagal muat: `shellMessages.firstLoadFailed` + "Try again". Tanpa sesi → login dengan `next=/tips`.
- Registry menolak id Tip yang sama dengan isi berbeda di dua level (deferred-work 3.4).
- Teks chrome Inggris; pesan dari `src/messages/id.ts` dan isi Tip berbahasa Indonesia (`lang="id"`).

**Never:**
- Epic 4/5: History List Dashboard, Records, unlock, "Practice again", item Test asli; tautan dari Results ke Tips & Tricks.
- Tabel/kolom/cache koleksi, migrasi DB, indeks baru, grant baru, service role.
- Membaca Tip dari konten saat ini (selalu dari `Result` tersimpan); mengubah grader atau `Result`.
- Pencarian global di header, paginasi, penyimpanan filter di server.
- Tes yang di-skip atau ditunda.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Normal | 2 percobaan L01-P1, 4 Tip berbeda di tiap percobaan, 2 id sama | 6 kartu, masing-masing sekali | — |
| Id sama, isi beda | id `kunci-sel` lama "A", terbaru "B" | satu kartu berisi "B" | — |
| Result v1 | soal `tip: null` | soal itu dilewati, soal lain tetap | — |
| Result tidak valid | gagal `resultSchema` | dilewati | log `tips.result_invalid` |
| Status lain / milik user lain / legacy tanpa result | `open`, `grading_failed`, user B, uji 2.12 | tidak menyumbang | — |
| >50 percobaan | 120 percobaan dinilai | Tip dari percobaan ke-51+ tetap ada | — |
| Item tak dikenal | `item_id` hilang dari registry | kartu tampil tanpa tag level, hanya di "All levels" | — |
| Filter level | pilih Level 1 | hanya kartu Level 1 | — |
| Cari | "ctrl+d", "SUM", "  kunci " | cocok di shortcut / judul / isi, tanpa beda huruf | — |
| Filter + cari tanpa hasil | Level 1 + "xyz" | pesan tanpa hasil + hapus filter → semua kartu | — |
| Kosong | belum ada Tip | pesan kosong + tautan Dashboard; tanpa kontrol filter | — |
| Baca gagal | error PostgREST | pesan muat pertama + "Try again" | log `attempt.list_tips_failed` |

</frozen-after-approval>

## Code Map

- `src/app/(app)/tips/page.tsx` -- placeholder to replace; keep `surfaceTitle("Tips & Tricks")`. Sidebar `/tips` already in `src/components/shell/nav-items.ts` (no nav change).
- `src/adapters/supabase/attempts.ts` -- `listGradedResults` (~line 576), `HISTORY_LIMIT`/`HISTORY_HEADROOM`, `Read<T>`, `logError`, `TABLE`: copy the query shape for the new reader. Do not change `listGradedResults` or History.
- `src/app/(app)/history/history-rows.ts` -- `LISTABLE_STATUSES`, `resultSchema` parse + drop/log pattern; `history-list.tsx` / `page.tsx` -- Suspense + skeleton + empty/failed pattern, login redirect. Reuse `LISTABLE_STATUSES` (move to core only if an import cycle forces it).
- `src/core/grading/result.ts` -- `Result`, `QuestionResult.tip: Tip | null`, `resultSchema`. `src/core/content/level-module.ts` -- `tipSchema` (id kebab, title, body, shortcuts), within-exam/within-level Tip checks (~281, ~421).
- `src/content/levels/index.ts` -- `levels`, `findItem`; add the cross-level Tip check here. `index.test.ts:306–311` -- existing Tip-uniqueness test pattern.
- `src/components/results/tips-card.tsx` -- `TipsCard({tip, questionNumber, correct, levelNumber})`; Results carousel uses it — keep Results output unchanged.
- `src/messages/id.ts` -- `shellMessages.firstLoadFailed`; add Tips messages.
- `src/test/dom.ts`, `src/core/grading/__fixtures__/results.ts` (`PRACTICE_85`, `PRACTICE_64`, `V1_NO_TIPS`), `src/app/(app)/history/history.dom.test.tsx` -- harness, fixtures, page-test mocking pattern. `supabase/tests` contract test for `listGradedResults` -- pattern for test:db.
- deferred-work.md lines 120–123 (cross-level Tip ids) -- close it with this ticket. Duplicate Tip ids across questions of one exam is already refused (`level-module.ts:289`).

## Tasks & Acceptance

**Execution:**
- [x] `src/core/progress/tips-collection.ts` (+ `index.ts`) -- `tipsCollection(rows: {itemId, startedAt, attemptId, result: Result}[], levelOf: (itemId) => number | null): CollectedTip[]` (`{tip, levelNumber}`), sorts input newest first itself, first seen id wins; output order newest-first-seen; plus pure `filterTips(tips, {level: number | "all", query})` (normalize with `toLocaleLowerCase("id-ID")`, trim; match title/body/any shortcut) and `tipLevels(tips)` -- AD-7 core, testable without DB/DOM.
- [x] `src/core/progress/tips-collection.test.ts` -- every I/O row that is pure: dedupe, newest wins regardless of input order and tie on `startedAt` by id, `tip: null`, unknown level, >50 rows, filter, search cases, AND, empty.
- [x] `src/adapters/supabase/attempts.ts` -- `listResultsForTips(supabase, userId): Read<StoredTipRow[]>` selecting `id, item_id, result, started_at`, same filters/order, paged with `.range()` in pages of `TIPS_PAGE = 200` until a short page, hard stop at `TIPS_MAX_ROWS = 5000` (log `attempt.list_tips_truncated`); log `attempt.list_tips_failed` -- all graded attempts, not 50.
- [x] `src/adapters/supabase/attempts.test.ts` -- query shape, paging across two pages, error → `{ok:false}`, null-result guard.
- [x] `supabase/tests/...` (existing contract-test file for the History list) -- owner-only read of the same columns as `authenticated` (run `npm run test:db`).
- [x] `src/app/(app)/tips/tips-data.ts` -- parse rows with `resultSchema`, drop + log `tips.result_invalid`, call `tipsCollection` with `findItem(...)?.level.number ?? null`.
- [x] `src/components/results/tips-card.tsx` -- make the "Soal N · Correct/Wrong" line optional (render only when `questionNumber` is given); Results unchanged.
- [x] `src/app/(app)/tips/page.tsx` + `tips-collection-view.tsx` (client) + `tips-skeleton` -- server page: session → login `/tips`, Suspense skeleton, failed/empty states; client view: level `<select>` (labelled "Level"), search `<input type="search">` (labelled "Search tips"), polite live count ("6 tips"), responsive card grid of `TipsCard`, no-results message + "Clear filters" button.
- [x] `src/messages/id.ts` -- `tipsEmpty`, `tipsNoMatch(level | null, query)` in Indonesian.
- [x] `src/content/levels/index.ts` (+ test) -- registry-load check: one Tip id across levels must have identical content; test with two fake levels.
- [x] `src/app/(app)/tips/tips.dom.test.tsx` -- renders each card once from two overlapping fixtures, filter narrows, search narrows (case), clear restores, empty, failed, skeleton `aria-hidden`, Results carousel test still green.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- mark the cross-level Tip-id entry done.

**Acceptance Criteria:**
- Given graded Production attempts, when `/tips` opens, then every Tip shown on their Results appears exactly once, and level filter plus search narrow the list.
- Given the 3.6/3.8 Results and History tests, when TipsCard gains the optional line, then they pass unchanged.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Contract test added in `supabase/tests/contract.db.test.ts` (History list block): A's graded/closed rows with a Result only, four columns, newest first; A's open, grading_failed and null-result rows and B's rows excluded. CI runs `npm run test:db` (`.github/workflows/ci.yml`), so it is verified there once CI runs; it could not run locally (no Docker / local Supabase).
- Skeleton lives in `tips-list.tsx` next to the server list (History's `history-list.tsx` pattern) instead of a separate `tips-skeleton` file.
- Cross-level check: `assertTipsAgreeAcrossLevels(levels)` in `src/content/levels/index.ts` runs at registry load; every item × scenario per level at `LOAD_CHECK_SEED` (other seeds are already proved within a level by `defineLevelModule`). `sameTip` is now exported from `level-module.ts`.
- Copy (illustrative, in `shellMessages`): `tipsEmpty` "Belum ada Tips. Selesaikan latihan dari Dashboard dulu, ya."; `tipsNoMatch(level, query)` → "Belum ada Tips untuk Level N — selesaikan latihan dulu, ya." (level only) or "Nggak ada Tips [Level N ]yang cocok dengan \"q\"." (with a query).
- `TipsCard` `questionNumber`/`correct` are optional; the "Soal N" line renders only when both are given (Results unchanged).
- Review fixes: `tipsCollection` trusts the adapter's DB order (`started_at desc, id desc`) and does not re-sort (JS Date drops microseconds); search normalizes with NFD + mark stripping, collapsed inner whitespace, trim, `id-ID` lower case; `listResultsForTips` reads one probe row past `TIPS_MAX_ROWS` and logs `attempt.list_tips_truncated` only when it exists (the probe row is not returned).

## Plan Change Log

## Review Triage Log

Four lenses (blind-hunter, edge-case-hunter, verification-gap, intent-alignment); no high-severity code defects.

- Fixed: JS re-sort by Date.parse dropped microseconds and had a NaN comparator; collection now trusts DB order (edge-case 1-2).
- Fixed: truncation log fired at exactly 5000 rows; now probes one extra row (edge-case 3).
- Fixed: cross-level Tip check only used scenarios[0]; now every scenario (intent 4, verification 2).
- Fixed: search folds diacritics and collapses inner whitespace (edge-case 5).
- Fixed: Soal line requires both questionNumber and correct (intent 5).
- Fixed: added DOM tests for newest-wins through tips-data, unknown-only levels, exact invalid-result log, aria-live count, search-only no-match, empty read; range-call count in adapter tests (verification 3-10).
- Fixed: contract test for listResultsForTips owner/status filters added; runs in CI "Contract tests" (verification 1).
- Deferred: offset paging can skip a row if an attempt is graded mid-read; cursor paging later (blind 2).
- Deferred: a Tip id shared by two levels gets one level tag; revisit when Level 2 ships (blind 3).
- Deferred: payload size / user notice past 5000 attempts (blind 1, edge-case 4); cap approved by user.
- Accepted: import-time throw on cross-level mismatch matches the per-level registry checks (blind 4); attemptId in tips.result_invalid log is not content (intent 1); extra tips.load_failed log and skeleton filter bars (intent 3, 6).

## Design Notes

- Newest attempt wins: a changed Tip id means the content was corrected; the newest stored Result reflects what the user last saw on Results, and it is deterministic. The cross-level registry check keeps future content from making one id mean two Tips.
- All attempts, paged: single user, ~4 Tips per attempt; reading only four columns in 200-row pages is cheap, and the 5000 cap guards a runaway loop. Filtering/search happen client-side on the already-small collection (the app's only search; no URL state needed).
- Cards hide "Soal N · ✓/✗": that status belongs to one attempt, not to the collected Tip.

## Verification

**Commands:**
- `npm run lint` -- expected: no errors
- `npx tsc --noEmit` -- expected: no errors
- `npm test` -- expected: all pass, none skipped
- `npm run build` -- expected: success; `/tips` dynamic
- `npm run test:db` -- expected: pass (new contract test)

**Manual checks (Production, after merge):**
- `/tips` shows each Tip from the graded L01-P1 attempts once with "Level 1"; Level filter and searching "Ctrl" / a title word narrow it; a nonsense query shows the no-results line and "Clear filters" restores; phone width without horizontal scroll.

## Production Evidence

- PR #24 merged; production deployment `dpl_J8TaK3dtpaH242zjKPispqeCfVQY` (commit 1b8207a) READY at 2026-11-19 01:40 UTC.
- CI on the final head: lint/typecheck/unit tests and DB contract tests (Postgres 16) green; the new `listResultsForTips` contract test ran there.
- User checked `/tips` on Production: collection without duplicates, level filter, search and "Clear filters" all as expected (user, 2026-11-19).
- Vercel runtime logs for the deployment (last 30-50 min): no error, warning or fatal records, and no `attempt.list_tips_failed`, `attempt.list_tips_truncated`, `tips.result_invalid` or `tips.load_failed` events. The success path writes no log lines by design.
