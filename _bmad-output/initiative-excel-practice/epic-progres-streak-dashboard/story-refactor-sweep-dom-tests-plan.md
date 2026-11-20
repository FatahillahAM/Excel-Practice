---
title: 'Sapu bersih refactor dan tes DOM yang tertunda'
type: 'feature'
ticket: '6'
created: '2026-11-19'
status: done
route: 'full'
route_source: ''
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: 'b1dd25c86760f9b0f74840a75da5cdb7cfea00d1'
context: ['{project-root}/_bmad-output/implementation-artifacts/deferred-work.md', '{project-root}/_bmad-output/initiative-excel-practice/epic-progres-streak-dashboard/epic-progres-streak-dashboard.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Entri tertunda epic 4 di `deferred-work.md` dan keputusan deferred/accepted dari review 4.1–4.5 belum didisposisi, dan permukaan epic 1–2 (Settings, ExamStatus tick, Orbit Loader, Upload Dropzone, dialog Abandon) masih hanya dicek manual walau harness DOM sudah ada sejak 3.3 (P3).

**Approach:** Satu sapu: tiap entri epic 4 diberi status akhir (done / moved / accepted, beserta bukti), kode mati dihapus, pesan "Streak restarted" yang ditunda dari 4.2 diputuskan, lalu tes DOM `*.dom.test.tsx` baru ditambahkan memakai harness yang ada. Lingkup item dari 4.5 baru diketahui setelah 4.5 selesai.

## Boundaries & Constraints

**Always:**
- Tiap entri yang menyebut epic 4 (baris 63, 75, 79, 83, 91, 159, 187 saat plan ini ditulis) plus deferral 4.1–4.5 mendapat status akhir dengan tanggal dan bukti; tidak ada entri epic 4 berstatus open/moved-to-epic-4.
- Tes DOM baru: Settings ("Not set", gagal-muat-pertama), ExamStatus tick, Orbit Loader pause/play dan tombol hilang saat reduced motion, Dropzone (fokus kembali setelah penolakan, alert/status, drag-over, keyboard, input nonaktif saat upload), Abandon (slot error, error basi disembunyikan, tutup saat selesai, kunci pending, focus trap dan kembali).
- Refactor tanpa perubahan perilaku; tes yang ada tetap lulus.
- Item 4.5: TBD — diisi dari Review Triage Log 4.5 saat tiket ini dimulai.

**Never:**
- Fitur baru, migrasi, atau perubahan UI terlihat (kecuali "Streak restarted" bila user setuju). Tes media query nyata di jsdom (cukup kelas CSS, sesuai keputusan 4.3). Menutup entri yang butuh konten epic 5 — dipindah ke epic 5 dengan alasan.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Entri tertutup kode | P2 selesai di 4.4 | status done + bukti | — |
| Entri butuh epic 5 | "v1 level tanpa Test" (4.1) | moved — epic 5 + alasan | — |
| Entri diterima | race freeze vs grading (4.2) | accepted + alasan | — |
| Tes Dropzone | file ditolak | fokus kembali ke dropzone, alert diumumkan | — |
| Tes Abandon | action gagal lalu buka ulang | error lama tersembunyi | — |
| Tes Orbit | reduced motion | tombol pause/play tidak ada | — |

</frozen-after-approval>

## Code Map

- `_bmad-output/implementation-artifacts/deferred-work.md` -- epic-4 entries (lines 55–91, 159, 187).
- Plans 4.1–4.5 Review Triage Logs -- deferred/accepted items (e.g. 4.1 no-Test explanation, 4.2 freeze race, 4.3 stale-Result drop, phone CSS-only test).
- `src/app/(app)/settings/*` -- Settings "Not set" / first-load failure.
- `exam-status.dom.test.tsx` (3.3) -- existing harness pattern; extend for tick.
- Orbit Loader, Upload Dropzone, Abandon dialog components under `src/components` / `src/app/(app)/exam` -- locate at start.
- `src/app/(app)/dashboard/streak-hero*`, `src/core/progress/streak.ts` -- deferred "Streak restarted" message (4.2).
- vitest config / DOM setup -- existing jsdom project.

## Tasks & Acceptance

**Execution:**
- [x] `deferred-work.md` -- disposition every epic-4 entry and 4.1–4.5 deferrals -- ticket verify.
- [x] dead code removal found during the sweep (grep unused exports, e.g. `PHONE_QUERY` if unreferenced) -- cleanup.
- [x] `settings/*.dom.test.tsx`, `orbit-loader.dom.test.tsx`, `upload-dropzone.dom.test.tsx`, `abandon-dialog.dom.test.tsx`, extend `exam-status.dom.test.tsx` -- parked DOM tests (P3).
- [x] "Streak restarted" message -- implement or move per Open Question.
- [x] 4.5 leftovers -- TBD after 4.5 lands.

**Acceptance Criteria:**
- Given `deferred-work.md`, when grepped for epic 4, then no entry is open or "moved — epic 4".
- Given CI, when the DOM project runs, then the new tests pass without flakiness (fake timers for tick/poll).

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Dispositions in `deferred-work.md` (sweep 4.6): done — ExamStatus loop/tick, Orbit toggle, Dropzone, Abandon, the dead `closed` allowance (4.2's freezes migration), "Streak restarted", 4.5 manual checks; accepted — no cache across devices (4.1), freeze vs grading race (4.2), stale Result dropped (4.3), phone gating CSS-only test (4.3); moved to epic 5 (konten-level-1-4, Notes) — v1 level without a Test (4.1) and the sidebar "L3" / "levels passed of 9" (4.5). No epic-4 entry stays open.
- Sidebar count not built: 4.6's frozen Never allows no visible UI besides "Streak restarted", and with no Test item no level can be passed (0 of 9 for everyone), so it moves to epic 5 with the first Test.
- "Streak restarted": `streak().restarted` (today and yesterday uncovered, a covered day 2–7 days back, `RESTARTED_WINDOW_DAYS`) — derived, nothing stored; Streak Hero renders `streakMessages.restarted` (EXPERIENCE.md copy verbatim) at zero, muted.
- Dead code: none found. Unused-export scan of epic-4 code (`PHONE_QUERY`, `LevelMapData`, `RECORDS_FALLBACK_ZONE`, `streakHeroState`, …) — all used (`PHONE_QUERY` by the Level Map sheet). Only stale comments updated (`upload.ts`, `sidebar-content.tsx`).
- New DOM tests: `settings/page.dom.test.tsx` (prerendered page: zone, "Not set", first-load failure, zone read failure), `components/exam/orbit-loader.dom.test.tsx`, `exam/[attemptId]/upload-dropzone.dom.test.tsx`, `dashboard/abandon-button.dom.test.tsx` (Code Map named `abandon-dialog`; the component is `AbandonButton`), two "(f) tick" tests in `exam-status.dom.test.tsx` (fake timers).
- Review fixes: `restarted` follows EXPERIENCE.md "first visit after a reset" (returning 3–7 days later still sees it; today frozen ends it), tests for 3/7/8 days, today frozen, 00:00:30 Jakarta and New York DST; Abandon unmount test resolves the pending action and unmounts the card in one `act`; the tick test asserts the interval is cleared on received; remaining accepted items from 4.2, 4.4 and 4.5 recorded in `deferred-work.md`.

## Plan Change Log

## Review Triage Log

One combined reviewer (bugs/edge cases, verification, sweep accuracy); no blocking defects; new tests stable across 3 runs; sweep evidence checked.

- Fixed: `restarted` only showed on the single day after a reset; now "first visit after a reset" (EXPERIENCE.md l.161): today and yesterday uncovered, a covered day 2–7 days back; today frozen → false. Tests for 3/7/8 days, frozen today, Jakarta midnight, New York DST.
- Fixed: Abandon unmount test proved nothing; now resolves the action and unmounts the card in one act.
- Fixed: ExamStatus tick test now asserts the interval is cleared after "received".
- Fixed: remaining accepted items from 4.2/4.4/4.5 triage logs recorded as `accepted` in deferred-work.md.
- Accepted: a freeze-only streak that lapses still shows "Streak mulai lagi dari 0" (consistent with the 4.2 decision).
- Open for user: sidebar level count moved to epic 5 (plan's Never forbids other UI; would read "0 of 9" until Test content); `streakMessages.restarted` copy from EXPERIENCE.md.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test` -- expected: pass incl. new DOM tests.
- `grep -n "epic 4" _bmad-output/implementation-artifacts/deferred-work.md` -- expected: only closed statuses.

## Open Questions

- "Streak restarted" message deferred from 4.2: build here or move? Recommendation: build here (small, copy-only, from `streak()` returning 0 after a previous streak) — it was explicitly deferred to 4.6.
- Accepted risks (freeze/grading race, stale Result dropped from progress): keep as accepted or move to post-V1? Recommendation: mark accepted with rationale; no code.
- Entries that need epic 5 content (no-Test explanation): Recommendation: move to epic 5 with the reason, not left open.
