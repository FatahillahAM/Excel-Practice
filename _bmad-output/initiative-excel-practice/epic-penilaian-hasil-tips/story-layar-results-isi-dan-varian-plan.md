---
title: 'Layar Results: isi dan varian'
type: 'feature'
ticket: '6'
created: '2026-11-16'
status: done
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: '8eaca15cd1612d97c6a71cd9acf7251791e349a4'
context: ['{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/DESIGN.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/mockups/key-results.html']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/results/<attemptId>` masih halaman minimal dari 3.1 (judul "Results", skor, "x of y correct"): tidak ada potongan hint, waktu, soal salah beserta alasannya, Tips untuk tiap soal, varian tenang di bawah 80, judul Test lulus, mode statis untuk History, maupun judul dokumen dan fokus `<h1>` setelah navigasi otomatis dari layar exam (CAP-5, CAP-8, U9).

**Approach:** Satu `ResultsView` yang dirender dari `Result` tersimpan saja (AD-3) plus waktu `received_at − started_at` (AD-8, kolom yang sudah ada): Outcome panel (Score Badge statis + baris potongan, label level, `<h1>` yang memuat hasilnya, "x of y correct", waktu), Wrong Answer Rows dengan "See tip" atau "Semua benar!", lalu Tips Carousel aksesibel untuk semua soal yang punya Tip. Varian ditentukan murni dari jenis item dan skor; prop `mode` (`live` | `static`) disiapkan untuk History (3.8). Tanpa migrasi DB.

## Boundaries & Constraints

**Always:**
- Sumber data hanya `Result` tersimpan (dibaca lewat sesi, divalidasi `resultSchema`) + `item_id`, `started_at`, `received_at` baris yang sama; konten level tidak dibaca ulang kecuali nama level/label item dari registry.
- `<h1>` selalu menyatakan hasil dalam teks: latihan "Practice N — S/100"; Test ≥80 "Test passed — S/100"; Test <80 "Test not passed — S/100, needs 80"; item tak dikenal registry "`<itemId>` — S/100". Lulus/tenang tidak pernah hanya lewat warna atau glow.
- Varian: skor ≥80 (latihan atau Test lulus) = badge `primary` dengan glow statis; skor <80 = tenang (badge datar `muted`, ring `input-border`, tanpa glow, tanpa merah di suasana). Mode `static` = badge datar apa pun skornya, tanpa pindah fokus.
- Score Badge statis (tanpa putaran, hitung naik, api, atau adegan scroll — semua milik 3.7) dan `aria-hidden` karena skornya sudah ada di `<h1>`; komponen memberi kait `data-variant`/`data-mode` untuk 3.7.
- Baris potongan di bawah badge: "No hints" atau "Hint ×N" + "−5N" (warna `warning`), terbaca pembaca layar.
- Waktu = `received_at − started_at` dalam format `mm:ss` / `h:mm:ss`; disembunyikan bila tidak bisa dihitung.
- Hanya soal salah yang didaftar (heading "Wrong answers" + jumlah): "✗ Soal N", `reasonText` (`lang="id"`), "See tip" bila soal itu punya Tip. Semua benar → "Semua benar!" (`lang="id"`, `success`) menggantikan daftar.
- Tips Card untuk setiap soal yang `tip`-nya tidak `null`, urut nomor soal: tag "Level N", "✓/✗ Soal N · Correct/Wrong" (glyph `aria-hidden`, status dalam teks), judul dan isi `lang="id"`, tiap shortcut dipecah pada `+` menjadi `Kbd` (`kbd-tips`); kartu bukan tab stop.
- Tips Carousel: `role="region" aria-roledescription="carousel" aria-label="Tips" tabindex="0"`; tombol Prev/Next (nama aksesibel "Previous tip"/"Next tip", ≥ target-min) dan panah kiri/kanan pada region memindah tepat satu kartu; di ujung tombol `aria-disabled` dan fokus tetap; "Tip k of n" di live region polite; scroll-snap per kartu; tanpa auto-advance; smooth scroll hanya lewat CSS (aturan reduced motion global mematikannya).
- "See tip" memindah carousel ke kartu soal itu dan memfokuskan region; tanpa JS tetap anchor `#tip-N`.
- Mode `live` (halaman `/results/<id>`): judul dokumen memuat hasil (`surfaceTitle(<h1>)`), dan fokus pindah ke `<h1>` (`tabindex="-1"`) saat halaman dimuat, termasuk setelah navigasi otomatis dari exam.
- Teks chrome Inggris; teks Indonesia baru di `src/messages/id.ts`.

**Never:**
- Gerak Results (putaran, hitung naik, Fire Effect, adegan 3D scroll, glow animasi) — 3.7. Daftar/halaman History — 3.8 (hanya prop `mode="static"`). Koleksi Tips & Tricks — 3.9 (hanya Tips Card yang bisa dipakai ulang).
- "Practice again", "New record", "Level N unlocked!"/"Level 4 complete!", "Back to Level Map", "Try the Test again" (epic 4). Item Test asli (epic 5): varian Test dibuktikan dengan fixture.
- Migrasi DB, perubahan `Result`/`RESULT_VERSION`, grader, atau layar exam (navigasi otomatis yang ada tetap).
- Membaca snapshot atau kunci jawaban; memanggil Supabase dari browser.
- Tes yang di-skip atau ditunda.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Latihan ≥80 | L01-P1, skor 85, 4 of 4, `hintsUsed` 3, 06:48 | `<h1>` "Practice 1 — 85/100", badge `primary`+glow, "Hint ×3 −15", "4 of 4 correct", "06:48", "Semua benar!", 4 Tips Card, "Tip 1 of 4" | — |
| Latihan <80 | skor 64, 2 salah | varian tenang, 2 Wrong Answer Rows dengan alasan dan "See tip", carousel semua kartu | — |
| Tepat 80 / 79 | skor 80 / 79 | 80 = varian ≥80; 79 = tenang | — |
| Test lulus | fixture `kind: "test"`, skor 88 | `<h1>` "Test passed — 88/100", label "Test · Level N — <nama>", varian ≥80 | — |
| Test tidak lulus | fixture Test, skor 72 | `<h1>` "Test not passed — 72/100, needs 80", tenang | — |
| Mode static | Result apa pun, `mode="static"` | badge datar, isi sama, fokus tidak dipindah | — |
| Result lama tanpa Tip | v1, semua `tip: null` (Production 3.1–3.3) | tidak ada bagian Tips, tidak ada "See tip"; sisanya normal | — |
| Tip sebagian | sebagian soal `tip: null` | kartu hanya untuk soal ber-Tip, "Tip k of n" menghitung kartu itu, "See tip" hanya di soal ber-Tip | — |
| Carousel | klik Next / ArrowRight | satu kartu maju, "Tip 2 of n"; di kartu terakhir Next `aria-disabled`, fokus tetap; Prev/ArrowLeft mundur | — |
| See tip | klik "See tip" di Soal 2 | carousel ke kartu Soal 2, live "Tip k of n", region terfokus | — |
| Shortcut | `Ctrl+Shift+%` | tiga `Kbd` dipisah "+" | — |
| Waktu tak ada | `received_at` null / tidak terbaca | fakta waktu tidak tampil | — |
| Item tak dikenal | `item_id` tidak ada di registry | label `item_id`, `<h1>` "`<itemId>` — S/100", varian dari skor | — |
| Graded tanpa Result | baris SQL lama / bukan milik user / belum dinilai | 404 (seperti sekarang) | — |
| Result rusak / baca gagal | gagal `resultSchema` / error DB | alert first-load + "Try again" (seperti sekarang), judul dokumen "Results" | log `results.load_failed` |
| Tanpa sesi | | Login lalu kembali ke `/results/<id>` | — |

</frozen-after-approval>

## Code Map

- `src/app/(app)/results/[attemptId]/page.tsx` -- current minimal page: keep Suspense + skeleton, `loadResult` (session → `readResult` → `resultSchema`), 404/first-load/login rules and log events. Replace static `metadata` with `generateMetadata`; render `ResultsView mode="live"`.
- `src/app/(app)/results/[attemptId]/page.test.tsx` -- server-render harness (`renderToStaticMarkup` of the Suspense child, mocked session/adapters/`next/navigation`); keep its 404/alert/login cases.
- `src/adapters/supabase/attempts.ts:511-553` -- `StoredResult`, `readResult` (selects `item_id, result`), `hasValidResult` (reuses `readResult`; semantics unchanged). The session already has column `select` on `started_at`, `received_at` (migration `20261104000001`), and `received_at` is stamped once at the first accepted file (`20261102000001`), so no migration.
- `src/core/grading/result.ts` -- `Result`, `QuestionResult` (`tip` nullable, `reasonText` null when correct), `RESULT_VERSIONS` [1, 2]; read-only apart from the pass constant.
- `src/core/content/level-module.ts:24,173,478` -- `LevelItemKind`, `SHORTCUT_RE` (never contains a bare `+` key, so splitting on `+` is safe), `itemLabel`; `LevelModule.name` (Indonesian level name). `src/content/levels/index.ts:16` `findItem`.
- `src/content/levels/01-fondasi/practice-1.ts:54` -- real `TIPS` (shortcuts `Ctrl+D`, `F4`, `Ctrl+Shift+%`) usable in fixtures.
- `src/app/(app)/exam/[attemptId]/exam-time.ts:15` -- `formatElapsed` (`mm:ss`/`h:mm:ss`) to reuse; `src/core/services/attempts/elapsed.ts` -- `elapsedSeconds`.
- `src/app/(app)/exam/[attemptId]/exam-status.tsx:253-257` -- auto-navigation (`router.replace(results)`); unchanged.
- `src/components/shell/page-title.tsx` -- `PageTitle` (`id`, `tabIndex` for a focus target, no ring); `src/components/shell/nav-items.ts:35` `surfaceTitle`.
- `src/components/ui/kbd.tsx` -- `Kbd` (comment already says "later, Tips Cards"); size via `className`.
- `src/test/dom.ts` -- harness (jsdom docblock, cleanup, matchMedia/pointer/scrollIntoView stubs); add an `Element.prototype.scrollTo` no-op stub if jsdom lacks it.
- `src/core/grading/__fixtures__/exam.ts` -- fixture home; add Results fixtures beside it.
- `src/app/globals.css:294-309` -- global reduced-motion rule (`scroll-behavior: auto`); tokens `--success`, `--warning`, `--destructive-soft`.
- `src/messages/id.ts` -- add `resultsMessages`.
- deferred-work.md -- no open entry belongs to 3.6; the 3.4 note "3.6 renders each key as a `Kbd`" (3.4 plan Design Notes) is honoured by the shortcut split.

## Tasks & Acceptance

**Execution:**
- [x] `src/core/grading/result.ts` (+`result.test.ts`, export from `index.ts`) -- `PASS_SCORE = 80` and `isPassingScore(score)` (≥80), shared with epic 4's Test gate.
- [x] `src/core/services/attempts/elapsed.ts` (+test) -- `formatElapsed` moved here (re-exported from `exam-time.ts` so the exam screen and its tests are unchanged) and `attemptDurationSeconds(startedAt, receivedAt): number | null` (null for missing/unparseable/negative).
- [x] `src/adapters/supabase/attempts.ts` (+`attempts.test.ts`) -- `readResult` selects `item_id, result, started_at, received_at`; `StoredResult` gains `startedAt: string`, `receivedAt: string | null`.
- [x] `src/core/grading/__fixtures__/results.ts` -- valid `Result` builders: practice 85 all-correct with 3 hints and Tips; practice 64 with 2 wrong; 80 and 79; Test 88 and 72; v1 all `tip: null`; partial null Tips. Each passes `resultSchema` (asserted in the DOM test file).
- [x] `src/components/results/outcome.ts` (+`outcome.test.ts`) -- pure: `resultsOutcome({item: {kind, number} | null, itemId, result})` → `{variant: "pass" | "calm", heading}` per the frozen headings; `deductionText(result)`; `levelLabel(level, kind)` ("Level N — name" / "Test · Level N — name"); `shortcutKeys("Ctrl+Shift+%")` → `["Ctrl","Shift","%"]`. Tests at 79/80, practice/Test/unknown, 0 and 3 hints.
- [x] `src/components/results/score-badge.tsx` -- static 168px disc (DESIGN › Score Badge): `pass` = `primary` face + static `glow-strong` shadow; `calm` or `static` = flat `muted`, `foreground` score, 2px `input-border` ring; score in `display-lg` + "/100" `label`; `aria-hidden`; `data-variant`, `data-mode`.
- [x] `src/components/results/tips-card.tsx` -- `TipsCard {tip, questionNumber, correct, levelNumber, id?}` (reused by 3.9); markup per DESIGN › Tips Card and mockup; shortcuts via `shortcutKeys` → `Kbd` with `kbd-tips` sizing joined by "+".
- [x] `src/components/results/results-details.tsx` -- `"use client"`: Wrong Answer Rows (DESIGN `destructive-soft`, `rounded.md`) or "Semua benar!", and the Tips Carousel (omitted when no Tip): index state, Prev/Next buttons, ArrowLeft/ArrowRight on the region, `aria-disabled` ends, polite "Tip k of n", each card `role="group" aria-roledescription="slide"`, `scrollTo` of the card on index change, index synced from user scroll (nearest card, on `scrollend`/debounced `scroll`), CSS snap + edge fade; "See tip" (`<a href="#tip-N">`, `preventDefault`) selects that card, scrolls the carousel into view and focuses the region.
- [x] `src/components/results/results-view.tsx` -- `ResultsView {itemId, item, level, result, durationSeconds, mode: "live" | "static"}`: 880px column; Outcome panel (badge column 200px left with deduction line, text right; stacked on phone), `PageTitle id="results-heading" tabIndex={-1}` with the heading, "x of y correct" (`success`), time fact, "Back to Dashboard" link; then `ResultsDetails`. In `live` mode a small client `ResultsFocus` focuses `#results-heading` on mount.
- [x] `src/app/(app)/results/[attemptId]/page.tsx` (+`page.test.tsx`) -- loader wrapped in React `cache()` returning `login | null | failed | loaded` (redirect done by the page, not the loader) so `generateMetadata` and the page read once; `generateMetadata` → `surfaceTitle(heading)` when loaded, else `surfaceTitle("Results")`, `robots: {index: false}`, never redirects; page renders `ResultsView mode="live"` with `attemptDurationSeconds`. Tests: heading, label, deduction, time, wrong rows, metadata title for loaded/failed/no session; existing 404/alert/login cases kept.
- [x] `src/components/results/results-view.dom.test.tsx` -- `// @vitest-environment jsdom` + `@/test/dom`: one test per matrix row from fixtures (≥80, <80, 80/79, Test passed, Test not passed, static, v1 no Tips, partial Tips, unknown item, no time, shortcut split); focus on `<h1>` after mount in `live`, not in `static`; carousel: Next → "Tip 2 of 4", Prev `aria-disabled` at start, Next at the end `aria-disabled` with focus kept and index unchanged, ArrowRight/ArrowLeft on the focused region, "See tip" → matching card index and region focused; glyphs `aria-hidden`, `lang="id"` on reasons and Tip bodies.
- [x] `src/test/dom.ts` -- `scrollTo` stub (and doc line) if missing.
- [x] `src/messages/id.ts` -- `resultsMessages.allCorrect = "Semua benar!"`.

**Acceptance Criteria:**
- Given a Result fixture for each variant, when `ResultsView` renders in jsdom, then the heading, badge variant, deductions, wrong rows or "Semua benar!", and Tips cards match the I/O matrix.
- Given a carousel of n cards, when Next, Prev or the arrow keys are used, then it moves exactly one card and announces "Tip k of n".
- Given the exam screen auto-navigates to a graded attempt, then the document title carries the outcome and focus is on the Results `<h1>`.
- Given `npm test`, then everything passes with no skipped tests; no migration file is added.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Loader states are a discriminated union (`login | missing | failed | loaded`): `missing` stands for the plan's `null`, same behaviour (404).
- `outcome.ts` also exports `deductionParts` (label + penalty, so the view can colour "−5N" in `warning`) and `levelLabelLead` (so the level name alone carries `lang="id"`); `deductionText` and `levelLabel` are built from them.
- `ResultsFocus` lives in its own file (`results-focus.tsx`) because `results-view.tsx` stays a server component.
- `TipsCard.levelNumber` is `number | null`: an item unknown to the registry has no level, so the "Level N" tag is left out.
- `ScoreBadge` adds `data-glow` next to `data-variant`/`data-mode`: in `static` mode the variant stays `pass` (from the score) while the face is flat.
- Carousel end: the last cards cannot scroll to their own snap position, so the scroll sync keeps the selected card when the track sits at that card's (capped) target (see Plan Change Log for the end-of-track rule).
- "See tip" has the accessible name "See tip, Soal N" (visible text "See tip") so several rows are distinguishable.
- `scrollTo` was missing in jsdom: stub and doc line added to `src/test/dom.ts`.

## Plan Change Log

Review patches (2026-11-16), behaviour that differs from the first build or refines the frozen text:

- "See tip" focuses the target Tips Card (slides are `tabindex="-1"`, named "Tip k of n"; still not tab stops) instead of the carousel region, so the reader lands on the card asked for. Modified or non-primary clicks are left to the browser; the `#tip-N` anchor stays.
- The current card is marked (`data-current`, `aria-current`, static `primary` border), so the position shows when the track cannot scroll. Arrow keys also work on a focused card, and focus follows.
- Carousel scroll sync: runs once on mount (anchor scroll before hydration); a resized track is put back at the current card (`ResizeObserver`); a user scroll that lands at the end selects the first of the cards sharing that position (no longer the last), and keeps the current card when it is one of them. The carousel is keyed on its cards, so another list starts at card 1.
- Deduction line shows the points actually taken, `pointsEarned − score` (floor at 0: 10 earned, 3 hints → "Hint ×3 −10"); equal to "−5N" otherwise. DOM text is "Hint ×3 −15" with a space; the heading reads "Wrong answers 2".
- "needs 80" comes from `PASS_SCORE`. An item kind that is neither `practice` nor `test` is shown like an unknown item (id heading and label).
- `tip` missing altogether is treated like `tip: null`.
- `ResultsFocus` focuses with `preventScroll`, and not when the URL has a fragment or focus is already inside `<main>`. The failed-load heading ("Results") gets the same id/`tabindex="-1"` and focus.
- `ScoreBadge` is three layers for 3.7: wrapper `[data-slot="score-badge"]` (data attributes, `aria-hidden`, static glow) → `[data-slot="score-badge-disc"]` → `[data-slot="score-badge-face"]` (colour, score). "Semua benar!", the wrong answers and the Tips each sit in a `<section>` (`data-slot="all-correct" | "wrong-answers" | "tips"`).
- "Soal N" in Results comes from `resultsMessages.question`. "See tip" is at least 24×24px. Fixtures added: `V1_NO_TIPS_80`, `FLOORED_0`.

## Review Triage Log

Four lenses (blind-hunter, edge-case-hunter, verification-gap, intent-alignment), 2026-11-16.

| # | Finding | Decision |
|---|---|---|
| 1 | Carousel scroll, target geometry and user-scroll sync never exercised by tests (jsdom has no layout) | patched — geometry-stubbed tests with a `scrollTo` spy, scroll/scrollend sync, defaultPrevented checks |
| 2 | Current card invisible when the track cannot scroll (wide screens, last cards share one position) | patched — static `border-primary` + `aria-current` on the current card |
| 3 | "See tip" focuses the whole region; swallows modified clicks | patched — focuses the target card; modified clicks pass through |
| 4 | Index stale after resize / pre-hydration anchor scroll / changed card list; end-of-track jump | patched — sync on mount, ResizeObserver, keyed carousel, end rule keeps the current card |
| 5 | Deduction row "Hint ×3−15" without space; overstated when the score floors at 0 | patched — real whitespace; shows `pointsEarned − score` |
| 6 | "Wrong answers2" accessible name; "needs 80" literal; non-practice kinds labelled Test | patched |
| 7 | `tip !== null` crashes on a missing `tip` key; duplicate shortcut React keys | patched |
| 8 | "See tip" target below 24px; "Soal N" hard-coded | patched — target size; `resultsMessages.question` |
| 9 | `<h1>` focus steals focus/scroll on reload, back, hash; failed branch never focuses | patched — `preventScroll`, hash and already-focused guards; failed heading focused |
| 10 | Page-level Test kind path untested | patched — `findItem` mocked with a Test item |
| 11 | 3.7 cannot build on a single-element Score Badge without breaking 3.6 tests | patched — wrapper / disc / face layers, assertions on data attributes, sections for "Semua benar!", v1 ≥80 fixture |
| 12 | Scroll-snap, smooth scroll, phone layout, title/focus after `router.replace` are browser-only | deferred — checked by hand in Production (no browser test layer) |
| 13 | `<code lang="en">` on Excel terms; ≥80 panel mockup styling; duplicate Tip ids as separate cards; Test removed from registry loses pass/fail heading | deferred |
| 14 | `cache()` de-duplication of the metadata/page read not observable in unit tests | accepted |
| 15 | `started_at`/`received_at` grants | rejected — migration 20261104000001 already grants both to the session |

Checks after patches: lint, typecheck, test (67 files, 1336), build pass.

## Design Notes

- [ASSUMPTION] "Test not passed — S/100, needs 80" is built now (outcome text belongs to the heading); its "Try the Test again" action is CAP-9 gating (epic 4). Every variant keeps "Back to Dashboard" until epic 4 adds its actions.
- [ASSUMPTION] Test passed heading per U9 is "Test passed — N/100" without "Level N unlocked!" (epic 4); Fire Effect in 3.7 hooks on `data-variant="pass"` + Test kind.
- [ASSUMPTION] Focus moves to `<h1>` on every `live` load, not only after auto-navigation: no reliable signal distinguishes them without changing the exam screen, and a direct load lands on the outcome too. `static` (History) does not move focus; 3.8 may revisit.
- [ASSUMPTION] Legacy Results with `tip: null` show no Tips section rather than a placeholder; only Production attempts from 3.1–3.3 are affected.
- [ASSUMPTION] Glow on ≥80 is a static shadow (styling, not motion); the turn and count-up arrive in 3.7.
- Title: `generateMetadata` and the page share one `cache()`d read; Next updates `document.title` on client navigation from metadata.

## Verification

**Commands:**
- `npm run lint` -- expected: clean.
- `npx tsc --noEmit` -- expected: no errors.
- `npm test` -- expected: green, DOM files under jsdom, no skipped tests.
- `npm run build` -- expected: succeeds.

**Production check (orchestrator/user, after merge; no migration, not hitl):**
- Open `/results/5fa43d9b…` (3.5): "Practice 1 — 85/100", badge with glow, "Hint ×3 −15", "4 of 4 correct", a time, "Semua benar!", 4 Tips cards; Next/Prev and arrow keys move one card with "Tip k of 4"; tab title shows the outcome.
- Open `/results/b55b185f…` (3.4, 20/100): calm badge, wrong rows with reasons and "See tip" that jumps to the card.
- Open `/results/7ee570ef…` or `fc496faf…` (v1, no Tips): page renders without a Tips section or "See tip".
- New L01-P1 attempt finished on the laptop: the exam screen moves to Results by itself, focus on the `<h1>`, title carries the score; phone width shows the stacked layout without horizontal scroll; runtime logs show no `results.load_failed`.

### Production evidence (2026-11-16, deployment `dpl_6sLfQMh4Qq7bZH9RRkWqyLzgyeEj`, PR #20)

No migration. Deployment ready 15:37 UTC.

| Time (UTC) | Event | Detail |
|---|---|---|
| 15:40:36 | `attempt.started` | attempt `91e3d0bc`, L01-P1, scenario `furnitur-jati-makmur` |
| 15:42:00 | `hint.revealed` | question 3, index 0, used 1 |
| 15:42:08 | `hint.revealed` | question 3, index 1, used 2 |
| 15:43:08.116 | macro submission | `received: true`, `duplicate: false` |
| 15:43:09.163 | `grading.done` | channel macro, outcome graded, score 60 |

Stored Result: 3 of 4 correct (question 4 wrong), points earned 70, `hintsUsed` 2, `hintPenalty` 10, score 60; duration 2 min 32 s. Expected on Results: "Practice 1 — 60/100" in the calm variant, "Hint ×2 −10", "3 of 4 correct", one wrong-answer row with "See tip", four Tips. No error lines. Browser-only items (auto navigation, carousel, phone layout) are confirmed by the user, not by logs.
