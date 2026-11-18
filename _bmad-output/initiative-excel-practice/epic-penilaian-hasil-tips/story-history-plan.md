---
title: 'History'
type: 'feature'
ticket: '8'
created: '2026-11-18'
status: 'built'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: 'd477bfc3190e23e3375d430ed830b2257235362b'
context: ['{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/DESIGN.md', '{project-root}/_bmad-output/initiative-excel-practice/epic-penilaian-hasil-tips/story-layar-results-isi-dan-varian-plan.md', '{project-root}/_bmad-output/initiative-excel-practice/epic-penilaian-hasil-tips/story-gerak-results-plan.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/history` masih placeholder, jadi hasil percobaan lama (skor, alasan soal salah, Tips) tidak bisa dibuka lagi untuk belajar (CAP-21). `ResultsView mode="static"` dari 3.6 sudah ada tetapi belum dipakai di mana pun.

**Approach:** Adapter sesi baru `listGradedResults` membaca percobaan milik user yang punya `Result` (terbaru dulu, dibatasi 50), halaman `/history` menampilkan baris (item, tanggal, skor, waktu) dengan keadaan kosong, Skeleton, dan galat muat pertama, dan setiap baris membuka rute baru `/history/<attemptId>` yang merender `ResultsView mode="static"` dari `Result` tersimpan yang sama dengan Results pertama. Tanpa migrasi DB dan tanpa dependensi baru.

## Boundaries & Constraints

**Always:**
- Hanya percobaan berstatus `graded` atau `closed` yang punya `result` non-null DAN lolos `resultSchema` yang tampil (U6). Baris uji 2.12 (`graded` tanpa `result`) dan `Result` tidak valid tidak pernah tampil; yang tidak valid dicatat (`history.result_invalid`, tanpa isi) dan dilewati, tidak menggagalkan halaman.
- Dibaca lewat sesi user (AD-9), RLS membatasi ke pemilik; kolom yang dibaca hanya yang sudah di-grant ke `authenticated`: `id, item_id, status, result, started_at, received_at`.
- Urutan terbaru dulu: `started_at desc, id desc` (memakai indeks `attempts_user_started_idx` yang sudah ada). Batas 50 baris tanpa paginasi; bila tepat ada lebih, baris ke-51 tidak ditampilkan dan tidak ada teks tambahan.
- Baris: nama item (mis. "Level 1 · Practice 1"; item tak dikenal → `itemId`), tanggal (`started_at`, format `id-ID`, zona `Asia/Jakarta`), skor `S/100`, waktu (`formatElapsed(received_at − started_at)`, `—` bila null). Seluruh baris adalah satu tautan ke `/history/<id>`.
- Detail History: skor, "x of y correct", potongan, alasan soal salah, dan Tips identik dengan Results pertama karena keduanya merender `Result` tersimpan yang sama lewat loader yang sama. `mode="static"`: tanpa putaran, hitung naik, count-up marker, api, adegan scroll, dan tanpa memindahkan fokus ke `<h1>`.
- Detail: tanpa sesi → login dengan `next` ke `/history/<id>`; bukan milik user / tanpa Result / id tidak valid → 404; Result tidak valid atau baca gagal → pesan muat pertama + "Try again". Ada tautan "Back to History".
- Kosong: satu baris pesan + tautan ke Dashboard. Memuat: Skeleton berbentuk daftar baris (dan Skeleton Results di detail). Gagal baca daftar: `shellMessages.firstLoadFailed` + "Try again".
- Teks chrome Inggris; pesan dari `src/messages/id.ts` tetap bahasa Indonesia.

**Never:**
- History List di Dashboard (epic 4), koleksi Tips & Tricks (3.9), "Practice again" / "New record" (epic 4), filter atau pencarian History, paginasi.
- Migrasi DB, indeks baru, grant baru, service role, atau mengubah isi/teks `ResultsView`, grader, dan `Result`.
- Menghitung ulang skor atau Tips dari konten saat ini (selalu dari `Result` tersimpan).
- Tes yang di-skip atau ditunda.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Daftar normal | 3 percobaan `graded` dengan Result valid | 3 baris terbaru dulu: item, tanggal, skor, waktu; tiap baris tautan `/history/<id>` | — |
| Baris legacy | `graded` tanpa `result` (uji 2.12) | tidak tampil | — |
| Result tidak valid | `result` gagal `resultSchema` | baris dilewati, sisanya tampil | log `history.result_invalid` |
| Status lain | `open`/`received`/`grading_failed`/`abandoned` | tidak tampil | — |
| `closed` dengan Result | status `closed`, Result valid | tampil | — |
| Milik user lain | baris user B | tidak tampil (RLS) | — |
| Kosong | tidak ada yang memenuhi | pesan satu baris + tautan Dashboard | — |
| >50 | 60 percobaan | 50 terbaru | — |
| `received_at` null | baris lama | waktu `—` | — |
| Item tak dikenal | `item_id` dihapus dari registry | nama = `itemId`, baris tetap bisa dibuka | — |
| Baca daftar gagal | error PostgREST | pesan muat pertama + "Try again" | log `attempt.list_results_failed` |
| Buka detail | klik baris skor 85 | `ResultsView mode="static"`: 85/100, alasan & Tips sama dengan Results pertama; tanpa atribut gerak/marker; fokus tidak dipindah | — |
| Detail tanpa sesi / bukan milik / tanpa Result | `/history/<id>` | login dengan `next` / 404 / 404 | — |
| Detail Result tidak valid | schema gagal | 404 (sama seperti daftar yang tidak menampilkannya; keputusan user 2026-11-18) | log `results.load_failed` |

</frozen-after-approval>

## Code Map

- `src/app/(app)/history/page.tsx` -- placeholder (`PlaceholderPage`) to replace; keeps `surfaceTitle("History")`.
- `src/app/(app)/results/[attemptId]/page.tsx` -- live Results: `loadResult` (`cache()`d: session → `readResult` → `resultSchema.safeParse` → `{login|missing|failed|loaded}`), `outcomeOf`, failed card, `ResultsSkeleton`, `generateMetadata`. Extract `loadResult`, `outcomeOf`, the failed card and `ResultsSkeleton` into a shared module so live and History detail render the identical Result path; keep behaviour/log names unchanged and existing tests green.
- `src/components/results/results-view.tsx` -- `ResultsView({itemId, item, level, result, durationSeconds, mode})`; `mode="static"` already skips `ResultsFocus` (line 99) and 3.7 motion gates. Do not change content.
- `src/components/results/count-up-marker.ts`, `use-play-once.ts`, `fire-effect.tsx` -- live-only; static must not set the marker (assert in tests).
- `src/adapters/supabase/attempts.ts` -- `readResult` (line ~528, pattern to copy: `Read<T>`, `logError`, `errorName`, `isAttemptId`), `TABLE`. Add `listGradedResults`.
- `src/core/grading` (`resultSchema`, `Result`), `src/core/services/attempts` (`attemptDurationSeconds`), `src/core/services/attempts/elapsed` (`formatElapsed`), `src/content/levels` (`findItem`).
- `src/components/shell/nav-items.ts` -- `/history` already in menu; `activeNavItem` already marks `/history/<id>` active. `page-title.tsx` -- `PageTitle`.
- `src/components/ui/` -- no Skeleton component exists; skeletons are inline `bg-muted` blocks (`ResultsSkeleton`). Follow that pattern (no new ui primitive).
- `src/messages/id.ts` -- `shellMessages.firstLoadFailed`; add `historyEmpty` (Indonesian, one line).
- `supabase/migrations/20261102000001_attempts.sql:30` -- `attempts_user_started_idx (user_id, started_at desc)` already serves the list; no new index.
- `src/test/dom.ts`, `src/core/grading/__fixtures__/results.ts` (`PRACTICE_85`, `PRACTICE_64`, `TEST_88`, `V1_NO_TIPS`), `src/components/results/results-view.dom.test.tsx` / `results-motion.dom.test.tsx` -- harness and fixtures to reuse; `src/app/(app)/dashboard/page.test.tsx` -- pattern for mocking session adapters in page tests.
- deferred-work: no open item is assigned to 3.8. Related, unchanged: line 165 (removed Test item loses its heading — applies equally to History detail).

## Tasks & Acceptance

**Execution:**
- [x] `src/adapters/supabase/attempts.ts` -- add `HISTORY_LIMIT = 50` and `listGradedResults(supabase): Promise<Read<StoredHistoryRow[]>>` (`{id, itemId, status, result: unknown, startedAt, receivedAt}`): `.select("id, item_id, status, result, started_at, received_at").in("status", ["graded","closed"]).not("result","is",null).order("started_at",{ascending:false}).order("id",{ascending:false}).limit(HISTORY_LIMIT)`; log `attempt.list_results_failed` -- session read, owner via RLS.
- [x] `src/adapters/supabase/attempts.test.ts` -- query shape (filters, order, limit), error → `{ok:false}`, null-result guard.
- [x] `src/app/(app)/history/history-rows.ts` (+`.test.ts`) -- pure `toHistoryRows(rows)`: parse with `resultSchema`, drop + log invalid, map item label via `findItem`, date (`Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta", dateStyle:"medium", timeStyle:"short"})`), score, duration -- testable without DOM.
- [x] `src/app/(app)/results/load-result.ts` -- move `loadResult`, `outcomeOf`, `ResultsLoadFailed` card, `ResultsSkeleton` here (shared); `results/[attemptId]/page.tsx` imports them, behaviour unchanged.
- [x] `src/app/(app)/history/page.tsx` -- server page: `Suspense` with `HistorySkeleton` (inline `bg-muted` row blocks, `aria-hidden`), session check → login redirect `/history`, list / empty (`historyEmpty` + link `/dashboard`) / failed (`firstLoadFailed` + "Try again"); rows as `<ul>` of `<a href="/history/<id>">` with row hover (`hover:bg-muted`).
- [x] `src/app/(app)/history/[attemptId]/page.tsx` -- shared loader; `ResultsView mode="static"`; "Back to History" link; same login/404/failed handling with path `/history/<id>`; `generateMetadata` title = outcome heading; Suspense fallback `ResultsSkeleton`.
- [x] `src/messages/id.ts` -- `historyEmpty: "Belum ada hasil. Mulai latihan dari Dashboard, ya."`.
- [x] `src/app/(app)/history/history.dom.test.tsx` -- list render (order, label, date, score, `—` time, hrefs), empty state + Dashboard link, failed state, Skeleton fallback (render `HistorySkeleton`, `aria-hidden`), legacy/invalid rows absent.
- [x] `src/app/(app)/history/[attemptId]/page.dom.test.tsx` -- detail with `PRACTICE_85` and `TEST_88`: same score/reasons/Tips text as the live page render of the same Result, `data-mode="static"`, no count-up marker / fire / motion attributes, `document.activeElement` not moved to `<h1>`; 404 and login branches.

**Acceptance Criteria:**
- Given an attempt first seen on `/results/<id>`, when opened from History, then the score, wrong-answer reasons and Tips text are identical and nothing animates.
- Given the live Results tests from 3.6/3.7, when the loader is extracted, then they pass unchanged.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Shared loader lives in `src/app/(app)/results/load-result.tsx` (not `.ts`): it holds JSX (`ResultsLoadFailed`, `ResultsSkeleton`). `ResultsLoadFailed` takes `focus` so live Results keeps moving focus to the `<h1>` and the History detail does not.
- The list UI (`HistoryList`, `HistorySkeleton`) lives in `src/app/(app)/history/history-list.tsx`, because a Next `page.tsx` may only export page fields; `page.tsx` keeps the title and the Suspense boundary.
- `attempts.test.ts` fake PostgREST builder gained `not`, `order`, `limit` (harness only; no existing assertion changed). Live Results tests unchanged and green.
- "Back to History" uses `next/link` (lint rule); the list's "Try again" stays a plain `<a>` for a full reload like the other first-load alerts (eslint-disable on that line).
- Build lists `/history` as dynamic (ƒ) and `/history/[attemptId]` as partial prerender (◐), the same as `/results/[attemptId]`; the Result is read per request inside Suspense.

## Plan Change Log

- 2026-11-18 — review patches (four lenses): (1) `listGradedResults(supabase, userId)` adds `.eq("user_id", userId)` on top of RLS; (2) it reads `HISTORY_LIMIT + HISTORY_HEADROOM` (50 + 20) rows and `toHistoryRows` slices to 50 after dropping invalid Results, so a few invalid newest rows no longer shorten the list (frozen "batas 50" meaning kept: at most 50 shown); (3) History detail opens only what the list would show: `readResult` now also selects `status`, the shared loader returns `invalid` separately from `failed`, and `/history/<id>` gives 404 for a status other than `graded`/`closed` or a schema-invalid Result (still logged `results.load_failed`) — this replaces the frozen matrix row "Detail Result tidak valid → pesan muat pertama" for History only; live `/results/<id>` keeps the alert; read failures still show the alert; (4) the History detail's failure `<h1>` and fallback document title say "History"; (5) each row link has an accessible name "label, date, score S/100, time mm:ss" (`aria-label` from the same values) and the time shows a visible "time" label; (6) the list page's catch logs `history.load_failed` (the adapter alone logs `attempt.list_results_failed`); (7) contract DB test for the list query as `authenticated`; (8) detail tests add `V1_NO_TIPS` and a list-href → detail case; (9) EXPERIENCE.md notes "Practice again" deferred to epic 4; (10) two deferred-work entries. `readResult`'s query-shape test now expects `status` in the select (same assertion, one more column).


## Review Triage Log

Four lenses (blind-hunter, edge-case-hunter, verification-gap, intent-alignment), 2026-11-18.

| # | Finding | Decision |
|---|---|---|
| 1 | List query relies on RLS alone | patched — explicit `user_id` filter |
| 2 | Real PostgREST/RLS semantics of the list never tested (fake client only) | patched — contract DB test: owner-only, order with tie, exclusions, column grants, RLS without the filter |
| 3 | 50-row cap applied before invalid Results are dropped | patched — fetch 70, filter, then cap at 50 |
| 4 | Detail opens attempts the list would hide (status, invalid Result) | patched — 404 unless graded/closed with a valid Result (404 confirmed by the user 2026-11-18; frozen matrix row amended) |
| 5 | Failure heading / fallback title say "Results" on History detail | patched — "History" |
| 6 | Row link accessible name runs fields together | patched — labelled `aria-label`; visible "time" label |
| 7 | Duplicate list-failure log; catch path untested | patched — `history.load_failed`, tested |
| 8 | Verify claim compared only two fixtures; list → detail path untested | patched — `V1_NO_TIPS` case, row href followed into detail |
| 9 | EXPERIENCE.md still promises "Practice again" on History | patched — note: deferred to epic 4 |
| 10 | `page-enter` transition on static History pages; same-minute dates | deferred |
| 11 | Row date is `started_at`, not completion | accepted — user decision 2026-11-18 |

Checks after patches: lint, typecheck, test (72 files, 1409), build, test:db (127) pass.

## Design Notes

- Route over query param: `/history/<id>` keeps the sidebar "History" active (existing `activeNavItem`), gives a natural "Back to History", and keeps `/results/<id>` strictly live (3.7 count-up marker logic untouched).
- Limit 50 without pagination: single user, a handful of attempts per day; 50 rows with jsonb `result` is well under 1 MB, and the existing `(user_id, started_at desc)` index serves filter+order. Pagination joins epic 4 if ever needed.
- Validating in the page layer (`toHistoryRows`) rather than in SQL keeps U6 ("schema-valid Result") exact.

## Verification

**Commands:**
- `npm run lint` -- expected: no errors
- `npx tsc --noEmit` -- expected: no errors
- `npm test` -- expected: all pass, none skipped
- `npm run build` -- expected: success; `/history` and `/history/[attemptId]` dynamic

**Manual checks (Production, after merge):**
- `/history` lists the graded Production attempts (e.g. `91e3d0bc` 60, `e9fafb75` 100) newest first; the 2.12 SQL-graded rows do not appear.
- Opening `e9fafb75` shows 100/100, same reasons and Tips as its first view, no turn/count-up/fire; reload identical. Skeleton visible on slow network; phone width without horizontal scroll.

### Production evidence (2026-11-18, PR #23)

No migration. User checked on Production after the merge: `/history` lists the recent graded attempts newest first; opening a row shows the same Results as its first view (score, reasons, Tips) with no motion and a "Back to History" link; phone layout fine. Opening History writes no log lines, so this rests on the user's check.
