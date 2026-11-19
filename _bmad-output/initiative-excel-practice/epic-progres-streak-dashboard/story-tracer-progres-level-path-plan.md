---
title: 'Tracer: progres dari attempt graded → Level Path di Dashboard'
type: 'feature'
ticket: '1'
created: '2026-11-19'
status: 'in-review'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: 'b5c844460c952804ef497087684975bbb50e7f26'
context: ['{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/DESIGN.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Dashboard belum menunjukkan progres apa pun: tidak ada level terbuka, pips, atau Level Path, dan `level-panel.ts` masih menerima `completed` kosong karena belum ada model progres (AD-7). Akibatnya hasil yang dinilai di laptop tidak terlihat di HP (CAP-1, CAP-12).

**Approach:** Satu bacaan adapter sesi `listProgressAttempts` (attempt `graded` milik user: `item_id`, `started_at`, `received_at`, skor dari `result`) yang juga dipakai 4.2–4.4, plus fungsi murni `levelProgress(attempts, levels)` di `src/core/progress` (level terbuka, pips per level), dirender sebagai Level Path minimal di Dashboard secara server-side. Tanpa migrasi, tanpa counter tersimpan.

## Boundaries & Constraints

**Always:**
- Hanya attempt `graded` dengan `result` valid (`resultSchema`) yang dihitung (AD-5, AD-7); `closed` dan status lain diabaikan. Result tidak valid dilewati dan dicatat (`progress.result_invalid`, tanpa isi).
- Pips = jumlah practice 1–5 *berbeda* yang punya ≥1 attempt graded (skor berapa pun); pengulangan tidak menambah pip.
- Level terbuka: Level 1 selalu; Level N+1 terbuka bila Test Level N punya attempt graded skor ≥80 (`isPassingScore`). Level tanpa modul di registry atau `phase: "next"` = Under Construction. [ASSUMPTION] Aturan buka level sudah dihitung di sini agar tracer jujur; 4.3 menambah gerbang Test, akhir V1, dan Practice again di atas fungsi yang sama.
- Dibaca lewat sesi user (AD-9), `.eq("user_id")` + RLS, hanya kolom yang sudah di-grant; dirender di server per request, tanpa polling.
- Level Path: `nav aria-label="Level path"` + `<ol>` node Level 1 → Ujian Akhir (nama kurikulum), state passed / active (`aria-current="step"`) / locked / under construction; callout node aktif menampilkan Practice Pips + "x/5 practices done".
- Chrome Inggris; pesan `src/messages/id.ts` tetap Indonesia.

**Never:**
- Tabel/kolom progres, cache, migrasi, grant baru (AD-7, Deferred).
- Streak, freeze, Streak Hero (4.2); tombol Start/Test/Practice again di Dashboard dan pembatasan HP (4.3); Records (4.4); Level Map 3D (4.5); gerak masuk Level Path.
- Membaca skor dari konten saat ini atau menghitung ulang nilai.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Progres kosong | tidak ada attempt graded | Level 1 active 0/5, level lain locked/Under Construction | — |
| Satu practice | L01-P1 graded skor 40 | Level 1 pips 1/5 | — |
| Pengulangan | L01-P1 graded 3× | tetap 1/5 | — |
| Status lain | L01-P2 `open`/`received`/`grading_failed`/`abandoned`/`closed` | tidak menambah pip | — |
| Result tidak valid | L01-P3 `result` gagal schema | tidak dihitung, sisanya tampil | log `progress.result_invalid` |
| Item tak dikenal | `item_id` tidak di registry | diabaikan | — |
| Test lulus | L01-T graded 85 (fixture) | Level 1 passed, Level 2 active (atau Under Construction bila belum ada modul) | — |
| Test gagal | L01-T graded 70 | Level 2 tetap locked | — |
| Baca gagal | error PostgREST | Level Path diganti pesan muat pertama + "Try again"; Attempt Card tetap | log `attempt.list_progress_failed` |
| Lintas perangkat | dinilai di laptop, dibuka di HP | pips sama setelah reload | — |

</frozen-after-approval>

## Code Map

- `src/adapters/supabase/attempts.ts` -- `listGradedResults` / `listResultsForTips` (paging pattern, `Read<T>`, `logError`); add `listProgressAttempts`.
- `src/core/progress/index.ts`, `tips-collection.ts` -- pure-function module pattern; add `level-progress.ts`.
- `src/core/content/level-module.ts` -- `LevelModule`, `LevelItemKind`, `phase`, `itemLabel`; `src/core/grading/result.ts` -- `resultSchema`, `isPassingScore`, `PASS_SCORE`.
- `src/content/levels/index.ts` -- `levels` registry (only `01-fondasi` today), `findItem`.
- `src/app/(app)/levels/level-panel.ts` -- `PRACTICE_COUNT`, `PipState`, "until epic 4 feeds `completed`"; feed it from `levelProgress` so `/levels` and Dashboard agree.
- `src/app/(app)/dashboard/page.tsx` (+`page.test.tsx`) -- title + rail; add Level Path hero.
- `src/test/dom.ts` -- DOM harness; `src/core/grading/__fixtures__/results.ts` -- `PRACTICE_85`, `TEST_88`, `buildResult`.
- `supabase/migrations/20261102000001_attempts.sql` -- grants, `attempts_user_started_idx`.

## Tasks & Acceptance

**Execution:**
- [x] `src/adapters/supabase/attempts.ts` -- `listProgressAttempts(supabase, userId): Promise<Read<ProgressAttemptRow[]>>` (`{id, itemId, result: unknown, startedAt, receivedAt}`), `status = 'graded'`, `result not null`, `received_at asc, id asc`, paged like Tips with a hard cap + truncation log -- the one shared read for 4.1–4.4.
- [x] `src/adapters/supabase/attempts.test.ts` + contract DB test -- query shape, owner-only, excludes non-graded, error → `{ok:false}`.
- [x] `src/core/progress/level-progress.ts` (+`.test.ts`) -- `toGradedAttempts(rows)` (parse/drop invalid → `{itemId, score, startedAt, receivedAt}`) and `levelProgress(attempts, levels)` → per level `{number, name, state, practicesDone: Set<number>, testPassed}`; table tests for the matrix with fixture `LevelModule`s (incl. a Test item).
- [x] `src/app/(app)/levels/level-panel.ts` (+test) -- take completed ids from `levelProgress`; behaviour for content-less items unchanged.
- [x] `src/app/(app)/dashboard/level-path.tsx` -- server component: nodes, active callout with Practice Pips + "x/5 practices done"; skeleton shaped like the path.
- [x] `src/app/(app)/dashboard/page.tsx` -- load progress in Suspense beside the existing Attempt Card; failed state.
- [x] `src/app/(app)/dashboard/level-path.dom.test.tsx` -- states, `aria-current`, pips text, failed and empty states.

**Acceptance Criteria:**
- Given L01-P1 graded on Production from the laptop, when the Dashboard is opened on the phone, then Level 1 shows 1/5 pips (hitl).
- Given the same attempts, when `/levels` and `/dashboard` render, then both show the same practice statuses.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Adapter: `listProgressAttempts` + `ProgressAttemptRow`, `PROGRESS_PAGE` 200 / `PROGRESS_MAX_ROWS` 5000 (probe row, `attempt.list_progress_truncated`); contract DB test added under "Progress (4.1)" (not run locally; CI runs `test:db`).
- Core: `src/core/progress/level-progress.ts` exports `toGradedAttempts`, `levelProgress`, `CURRICULUM` (Level 1–9 names from `level-curriculum.md`) and `FINAL_EXAM_NAME`; `practicesDone` is `ReadonlySet<number>`. A level whose predecessor is Under Construction stays locked (nothing opens past a `next`/missing level).
- Shared server loader `src/app/(app)/progress.ts` (`loadProgress`, logs `progress.load_failed` on a throw) feeds both the Dashboard Level Path and `/levels`; `completedItemIds` in `level-panel.ts` maps progress to the panel's `completed`. On `/levels` a failed progress read shows the panel without progress (no extra alert); the Dashboard carries the alert.
- Level Path pips come from `levelPanel` (same view model as `/levels`); Ujian Akhir is a static Under Construction node. Dashboard layout: Level Path (own Suspense + skeleton) then the rail; the Attempt Card is unchanged.
- Note: the registry has no `L01-T` yet, so Level 1 cannot reach "passed" in Production until the Test item ships; covered by fixture modules in tests.

## Plan Change Log

## Review Triage Log

## Design Notes

- One read, many derivations: 4.2 (streak: `receivedAt`), 4.3 (gate: `itemId`, `score`), 4.4 (records: `receivedAt − startedAt`) consume `toGradedAttempts` output, so the adapter column list is fixed here. Ordered ascending because streak/records walk forward in time.
- [ASSUMPTION] Read every graded attempt (paged, capped like Tips at 5000) rather than a window: single user; a cache waits for >300 ms (AD-7 Deferred).
- [ASSUMPTION] Ujian Akhir and Level 5–9 appear as static Under Construction nodes generated from a fixed curriculum list, not from the registry (registry holds only playable modules).

## Open Questions

- Should `closed` attempts (Ujian Akhir, Next) count toward progress? AD-5 says only `graded`. Recommendation: `graded` only now; revisit with CAP-14.

## Verification

**Commands:**
- `npm run lint` -- expected: no errors
- `npx tsc --noEmit` -- expected: no errors
- `npm test` -- expected: all pass, none skipped
- `npm run test:db` -- expected: pass
- `npm run build` -- expected: success

**Manual checks (Production, hitl):**
- Grade L01-P1 on the laptop; open `/dashboard` on the phone: Level 1 pips match; Level 2–9 and Ujian Akhir locked/Under Construction; no horizontal scroll.
