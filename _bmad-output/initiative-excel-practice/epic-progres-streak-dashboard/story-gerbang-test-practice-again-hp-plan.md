---
title: 'Gerbang Test, aturan buka level, Practice again, dan pembatasan HP'
type: 'feature'
ticket: '3'
created: '2026-11-19'
status: 'built'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: 'bc3c2a352b0873eef27db81df5ba6e5ad097c876'
context: ['{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md', '{project-root}/_bmad-output/initiative-excel-practice/epic-progres-streak-dashboard/story-tracer-progres-level-path-plan.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Start belum mengikuti progres: Test tidak tergerbang 5 latihan, lulus Test tidak membuka level, tidak ada akhir V1, tidak ada Practice again, dan di HP Start masih bisa membuat attempt (CAP-9, CAP-1, CAP-19, D4). Bergantung pada 4.1 (`levelProgress`).

**Approach:** Perluas `levelProgress` dengan gerbang Test, aturan buka level, akhir V1 dan item yang boleh Practice again; server action Start menolak item yang tidak boleh dimulai; Level Detail Panel dan Level Callout menampilkan Start / Test / "Try the Test again" / Practice again; di HP Start dan Practice again menampilkan pesan HP tanpa memanggil server. Konten Test belum ada (epic 5), jadi aturan dibuktikan dengan `LevelModule` fixture.

## Boundaries & Constraints

**Always:**
- Test Level N terbuka setelah 5 practice berbeda punya attempt graded (skor berapa pun); "Test opens after 5 practices — k to go."
- Lulus = satu attempt graded Test skor ≥80 (`isPassingScore`), sekali cukup; membuka Level N+1. Test gagal → "Try the Test again" langsung, tanpa latihan tambahan.
- Lulus Test Level 4 → "Level 4 complete — Level 5 is coming soon", tidak ada level baru; level berikut tanpa modul atau `phase: "next"` → Under Construction tanpa Start.
- Practice again: tersedia pada practice selesai dan Test yang lulus; membuat attempt baru dengan data baru lewat jalur Start yang sama (AD-5); hasilnya dihitung streak/rekor tapi tidak pernah mengubah pips, gerbang, atau status level (pips = himpunan item, bukan jumlah).
- Saat ada attempt `open`/`received`/`grading_failed`: semua Start/Practice again disabled dengan "Resume or abandon the attempt in progress first." (DB sudah menjamin satu attempt aktif).
- Gerbang ditegakkan di server action Start (bukan hanya UI): item terkunci / Under Construction ditolak tanpa membuat attempt.
- HP = `(pointer: coarse) and (max-width: 1023px)`: Start dan Practice again menampilkan pesan HP inline (polite) dan tidak memanggil action, tidak mengunduh.

**Never:**
- Menyimpan status gerbang/unlock (AD-7); konten Test asli (epic 5); Level Map 3D dan eyebrow asli (4.5); Records/"New record" (4.4); mengubah grader.
- Mendeteksi HP di server lewat user-agent.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Test terkunci | 4 practice selesai | Test locked, "1 to go" | Start Test di server ditolak |
| Test terbuka | 5 practice (skor apa pun) | "Start Test" | — |
| Lulus | Test graded 80 | Level N passed, N+1 active | — |
| Gagal lalu ulang | Test graded 79 | "Try the Test again", tanpa syarat baru | — |
| Gagal setelah lulus | lulus 85 lalu Practice again 50 | tetap lulus | — |
| Level 4 lulus | fixture 4 level, Test L4 ≥80 | akhir V1, tidak ada level baru | — |
| Level berikut belum ada | lulus L1, registry tanpa L2 | L2 Under Construction, tanpa Start | Start ditolak |
| Practice again | L01-P1 selesai | attempt baru; pips tetap | — |
| Attempt terbuka | ada attempt `open` | semua Start/Practice again disabled + alasan | action menolak (unik DB) |
| HP | viewport coarse ≤1023px, tap Start | pesan HP, tanpa request, tanpa attempt | — |
| Item tak dikenal | Start `L09-P1` | ditolak | log |

</frozen-after-approval>

## Code Map

Adjust once 4.1 lands (`levelProgress` shape).

- `src/core/progress/level-progress.ts` (4.1) -- extend with `startable(itemId)` / gate states.
- `src/app/(app)/levels/level-panel.ts` (+test) -- `TestStatus` (`locked|open|unavailable`), `PracticeStatus`, `toGo`; add `passed|failed`, `practiceAgain`.
- `src/app/(app)/levels/start-actions.ts` (+test), `start-lock.ts`, `start-control.tsx`, `level-detail-panel.tsx` -- Start path and lock; add gate check, Practice again, phone gating.
- `src/core/services/attempts` -- only writer of attempts (AD-5); Practice again reuses Start.
- `src/app/(app)/dashboard/level-path.tsx` (4.1) -- Level Callout buttons.
- `src/content/levels/index.ts` -- registry; tests inject fixture modules instead.
- `src/core/content/level-module.ts` -- `defineLevelModule`, Test = item 6 `LNN-T`.

## Tasks & Acceptance

**Execution:**
- [x] `src/core/content/__fixtures__/levels.ts` -- fixture `LevelModule`s for Levels 1–4 each with 5 practices + Test (valid against `defineLevelModule`) -- proves gates without epic-5 content.
- [x] `src/core/progress/level-progress.ts` (+test) -- per item `{status, practiceAgain}`, test gate, unlock, V1 end, Under Construction; `canStart(progress, itemId)`; table tests for every matrix row incl. "Practice again never changes pips/gate".
- [x] `src/app/(app)/levels/start-actions.ts` (+test) -- refuse items `canStart` rejects (typed reason, no attempt); accept completed items as Practice again.
- [x] `src/app/(app)/levels/level-panel.ts`, `level-detail-panel.tsx` -- "Start Test", "Try the Test again", "Practice again", lock line, V1 end line.
- [x] `src/components/shell/use-is-phone.ts` -- `matchMedia` of the device-gating query; `start-control.tsx` shows the phone message instead of calling the action.
- [x] `src/app/(app)/dashboard/level-path.tsx` -- callout primary button + V1 end state.
- [x] `src/app/(app)/levels/*.dom.test.tsx` -- phone: tap shows message and action mock is never called; open-attempt lock text.

**Acceptance Criteria:**
- Given fixture Levels 1–4, when all four Tests pass, then the callout shows "Level 4 complete — Level 5 is coming soon" and nothing new unlocks.
- Given the phone media query matches, when Start or Practice again is tapped, then no Server Action or download is triggered.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `levelProgress` adds `testAttempted`; levels after `V1_LAST_LEVEL` (4) are Under Construction; `canStart(progress, modules, itemId)` returns `{ok, practiceAgain}` or a typed `StartRefusal` (`unknown_item | under_construction | level_locked | test_locked`); `v1Complete` drives the V1 end line. A level missing from the registry gives `unknown_item` at Start (its items do not exist).
- Start reads `listProgressAttempts` after the item lookup and returns `{status: "refused", reason}` (logged `attempt.start_refused`) before any generation or insert; a failed read is `startFailed`. No device check on the server.
- Fixture levels live in core (`src/core/content/__fixtures__/levels.ts`, self-contained generator, `defineLevelModule`-valid); `start-actions.gate.test.ts` mocks the registry with them to prove the server gate.
- Code Map deviation: no `src/components/shell/use-is-phone.ts`. Per the user decision, phone gating is CSS only (`[@media(pointer:coarse)_and_(max-width:1023px)]`) in `StartControl`: the real form is hidden and a look-alike `type="button"` outside any form shows `phoneStartMessage` in a polite status region. `PHONE_QUERY` is exported for reference.
- Panel: `levelPanel(level, completed, result)` adds Test `passed|failed`, `practiceAgain` per row and `primary` ("Start Practice N" / "Start Test" / "Try the Test again"); rows carry a secondary "Practice again"; the lock reason renders once (under the Primary Button, else its own line) and every control points at it. /levels shows the last passed level when none is active.
- Dashboard: `LevelPath` takes `startLock` from the page; the callout shows the Primary Button or the Test lock line; Level 4 passed shows "Level 4 complete — Level 5 is coming soon" + "Practice again" link to /levels.
- Review fixes:
  - A level with no Test item shows the Test as "unavailable" from the start.
  - Practices go in order on both sides: `canStart` refuses with `practice_locked` until every earlier practice that has content is done. The panel's next practice is the first one with content that is not done, so a practice without content does not block the next.
  - An unknown item id is refused through `canStart`: an id like `LNN-…` of a level without content is `under_construction`, anything else `unknown_item`. Both log `attempt.start_refused`.
  - `test_locked` carries `toGo`. Refusal copy is per reason (`startRefusedMessages`); `test_locked` reuses `testLockLine`.
  - /levels renders the panel only for an active or passed level (`state` is passed into the header), otherwise an empty state.
  - Phone button: with a lock it is `aria-disabled` and described by the lock reason. The reason now renders outside the form, so it shows on every device. The phone status comes after the button.
  - New action gate tests: Level 2 missing from the registry, L05-P1 after Level 4, a crafted L01-P5.

## Plan Change Log

## Review Triage Log

Two combined reviewers (blind+edge-case incl. server gate bypass, verification+intent-alignment); no blocking defects — a crafted Start cannot open a locked Test or level.

- Fixed: a level with no Test item showed "locked … k to go" until 5/5; now "unavailable" from the start (approved decision).
- Fixed: server did not enforce practice order (crafted L01-P5 on a new account started); `canStart` refuses with `practice_locked`; panel and server agree on "next" when a middle practice has no content.
- Fixed: /levels could show a level the server refuses; panel only for an active or last passed level, else an empty state; state in the panel header.
- Fixed: action gate tests for under_construction (no next module, L05 after L4) and practice_locked, `createAttempt` never called.
- Fixed: phone button ignored the open-attempt lock; now aria-disabled with the lock reason; phone status placed after the button.
- Fixed: unknown item now a typed refusal with `attempt.start_refused`; per-reason refusal copy (test_locked reuses the lock line with remaining count).
- Accepted: a stored Result that no longer matches `resultSchema` is dropped from progress and could hide a passed Test; prod Results all validate today — revisit with any schema version bump.
- Accepted: phone gating DOM test checks the CSS classes only (jsdom has no media queries); CSS-only gating was the approved approach.

## Design Notes

- [ASSUMPTION] Practice again on a passed Test is labelled "Practice again"; on a failed Test the button is "Try the Test again" (EXPERIENCE › Level Detail Panel).
- [ASSUMPTION] Phone gating is client-only (media query), as the convention says "call nothing"; server Start stays device-agnostic.
- [ASSUMPTION] Production proof of the gate waits for epic-5 Test content (epic Notes); this ticket's evidence is fixture tests.

## Open Questions

- Before hydration the phone check is unknown: render buttons disabled until `matchMedia` resolves, or enabled? Recommendation: render the phone message path by default on coarse pointers via CSS (`@media`) hiding the real button, so no flash allows a tap.
- Is Level 1's Test absence (registry has no `L01-T`) shown as "unavailable" (current) or Under Construction? Recommendation: keep "unavailable" with the existing copy until epic 5.

## Verification

**Commands:**
- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` -- expected: all pass, none skipped

**Manual checks:**
- Production on the phone: tapping Start Practice shows the phone message and no attempt appears on the laptop Dashboard; Practice again on L01-P1 from the laptop leaves pips unchanged.

## Production Evidence

- PR #29 merged; production deployment `dpl_APZB1aWuxnRVys4BuykS5NvMZoUm`. CI on the final head green (lint/typecheck/unit, DB contract tests).
- Practice again: 08:11:18 `attempt.started` L01-P1 (`897a2b62`) passed the gate → 08:12:31 macro `received: true` → `grading.done` graded 100. Pips unchanged per user.
- User checked /levels (Start / Practice again labels, L01 Test "unavailable") and phone gating (message, no attempt — no `attempt.started` from the phone in the log) (user, 2026-11-19).
- No error/warning logs; no `attempt.start_refused` during the check.
