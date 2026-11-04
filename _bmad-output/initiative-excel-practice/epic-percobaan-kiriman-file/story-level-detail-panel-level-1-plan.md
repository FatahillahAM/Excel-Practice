---
title: 'Level Detail Panel Level 1'
type: 'feature'
ticket: '6'
created: '2026-11-04'
status: 'in-progress'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
baseline_revision: 'e0468ab1f85da80db7366002811ce5ef85cde85c'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** /levels masih kartu tracer per item dengan tombol Start; Level Detail Panel (DESIGN.md, `key-level-map.html`) belum ada, jadi El Zavier tidak melihat 5 practice + Test Level 1 beserta statusnya, dan keputusan epic (Start ada di panel Level 1 pada /levels) belum terpenuhi.

**Approach:** /levels merender Level Detail Panel Level 1 secara inline dari registry (`LevelModule`): header level, Practice Pips + "0/5 practices done", baris Practice 1–5 dan Test dengan status, lalu Primary Button "Start Practice 1" = `StartControl` yang sama (action tidak berubah). Status dihitung helper murni dari item yang punya konten; panel menerima prop kunci Start untuk entry 7.

## Boundaries & Constraints

**Always:**
- Item dan label dari registry (`levels`, `itemLabel`); level dipilih tanpa bercabang pada id level (AD-2). Hanya item yang ada di registry bisa di-Start; hari ini hanya L01-P1.
- Satu Start di panel, di foot; baris tidak punya tombol Start sendiri (mockup HP: baris "Next" tanpa tombol).
- `startAttempt` dan perilaku `blocked` ("Resume or abandon the attempt in progress first." + "Go to the attempt") tetap persis seperti sekarang.
- Token warna DESIGN.md dari `globals.css`; mode gelap dan terang tanpa warna literal. Nama level `lang="id"`, chrome English.
- Pips `aria-hidden`, selalu berpasangan dengan teks "x/5 practices done".

**Never:**
- Attempt Card dan kunci Start selama percobaan terbuka (entry 7: hanya prop, tidak diisi); konten Practice 2–5 dan Test (entry 8); progres, best score, record time, streak, Practice again, Try the Test again (epic 3/4).
- Level Map, Level Node, 3D Scroll Scene, level lain, Sheet modal, pesan HP saat Start (epic 4, CAP-12).
- Membaca `attempts` untuk status; migrasi; DOM test harness (epic 4).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default | registry: L01-P1 saja | "Level 1 · Active", "Fondasi", pips: 1 next + 4 pending, "0/5 practices done"; P1 "Next"; P2–P5 "Not available yet"; Test terkunci "Test opens after 5 practices — 5 to go."; Best/Record "—"; tombol "Start Practice 1" | — |
| Start | klik "Start Practice 1" | `startAttempt` dengan `itemId=L01-P1` → `/exam/<id>?download=1` | gagal → pesan inline `startMessages` (sudah ada) |
| Percobaan terbuka | Start saat ada `open` | "Resume or abandon…" + "Go to the attempt" di slot inline (seperti sekarang) | — |
| Kunci dari luar | `startLock = { reason }` (entry 7) | tombol disabled (gaya disabled DESIGN.md), alasan di baris caption di bawahnya; form tidak terkirim | — |
| Konten bertambah | registry: L01-P1, L01-P2 (entry 8) | P1 Next, P2 "Not started", tetap satu Start (Practice 1) | — |
| Tanpa item siap | level tanpa item ber-konten | semua baris "Not available yet", tidak ada tombol Start | — |
| Tema | gelap / terang | warna sesuai token kedua tema, cocok mockup | — |
| HP 390px | lebar sempit | panel lebar penuh, Best/Record pindah ke caption baris, tombol lebar penuh | — |

</frozen-after-approval>

## Code Map

- `src/app/(app)/levels/page.tsx` -- tracer cards per item; becomes the panel. No data read today (static).
- `src/app/(app)/levels/start-control.tsx` -- `useActionState(startAttempt)`, hidden `itemId`/`timeZone`, `BLOCKED_MESSAGE`, inline `role="alert"` slot.
- `src/app/(app)/levels/start-actions.ts` (+test) -- Start pipeline; unchanged.
- `src/core/content/level-module.ts` -- `LevelModule`, `levelModuleSchema`, `itemLabel`; no curriculum functions field yet.
- `src/content/levels/{index.ts,01-fondasi/index.ts}` (+`index.test.ts`) -- registry, `fondasi` with `[practice1]`.
- `src/app/globals.css` -- tokens incl. `--glow`, `--warning`, `--accent`, `--primary-edge`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/core/content/level-module.ts`, `src/content/levels/01-fondasi/index.ts` -- add `functions: readonly string[]` (≥ 1, non-empty) to `LevelModule` and schema; Fondasi: `["$ references", "Excel Table (Ctrl+T)", "Sort & Filter"]` (level-curriculum.md) -- the header's functions line is content.
- [ ] `src/app/(app)/levels/level-panel.ts` (+`level-panel.test.ts`) -- pure `levelPanel(level, completed: ReadonlySet<string>)` → `{ doneCount, pips: ("done"|"next"|"pending")[5], practices: {number, label, itemId|null, status: "done"|"next"|"not_started"|"unavailable"}[5], test: {status: "locked"|"open"|"unavailable", toGo}, next: {itemId, label}|null }`; `next` = first practice with content not in `completed`; Test open only at 5 done with content; `testLockLine(toGo)`. Tests: the data rows of the matrix and `completed` = {P1}.
- [ ] `src/app/(app)/levels/level-detail-panel.tsx` -- server component: `<section aria-labelledby>` card at `max-w-[430px]` (full width on phone), eyebrow "Level N · Active" (flame icon, primary), `<h2 lang="id">` name in headline, functions in mono caption, pips + count, `<table>` (Item/Best/Record header, `scope="col"`; Test row `accent` tint; unavailable/locked rows muted; lock line with warning lock icon), foot `StartControl` for `next` with `startLock` passed through; no foot when `next` is null.
- [ ] `src/app/(app)/levels/start-control.tsx` -- optional `lock?: { reason: string }`: disabled, muted fill per DESIGN.md › Primary Button, reason line in caption under it (`id` in `aria-describedby`); full-width variant for the panel foot; Primary Button bottom edge `primary-edge`. Idle/error/blocked paths untouched.
- [ ] `src/app/(app)/levels/page.tsx` -- `PageTitle` "Level Map" + `LevelDetailPanel` for the first `phase: "v1"` level, `completed` empty, no `startLock`; tracer cards removed.
- [ ] `src/app/(app)/levels/page.test.tsx` -- `renderToStaticMarkup`, `./start-actions` mocked: one submit "Start Practice 1" with hidden `itemId` `L01-P1`; six rows; four "Not available yet"; "5 to go"; "0/5 practices done"; `lang="id"` on "Fondasi"; pips `aria-hidden`; no `<button>` in rows. `StartControl` with `lock`: `disabled` + reason text + `aria-describedby`.
- [ ] `src/content/levels/index.test.ts` -- Fondasi `functions`; schema rejects an empty `functions`.

**Acceptance Criteria:**
- Given /levels in dark and light theme, when opened at desktop and 390px width, then the panel matches the `key-level-map.html` panel (header, pips, rows, foot button) apart from the documented deviations below.
- Given a signed-in user with no attempt in progress, when "Start Practice 1" is pressed in the panel, then an attempt is created and the exam screen opens with the download, exactly as in entry 1.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).

## Plan Change Log

## Review Triage Log

## Design Notes

- [ASSUMPTION] Inline panel, not a `Sheet`: the panel opens from a Level Node (epic 4); a self-opening modal would trap focus on load. Epic 4 wraps the same component in `Sheet` (right on desktop, bottom on phone).
- [ASSUMPTION] Statuses come from content, not `attempts`: Done needs a graded attempt (epic 3) and the progress model is epic 4 (AD-7); `completed` is the seam. An open attempt is entry 7's lock, not a row status.
- [ASSUMPTION] Missing content shows a muted "Not available yet", not the Under Construction Tag. That tag is for `phase: "next"` levels and the side track (CAP-1, CAP-15); these items wait for entry 8.
- [ASSUMPTION] Test lock line uses the EXPERIENCE.md pattern with the live count: "Test opens after 5 practices — 5 to go." Best/Record show "—" (as for the Test row in the mockup) until epic 4.
- [ASSUMPTION] The panel shows the first V1 level of the registry. With no progress it is the active level, and the page never branches on a level id (AD-2). Other levels wait for the epic 4 Level Map.
- Seam for 2.7: `startLock?: { reason }` on the panel goes to `StartControl.lock`. 2.7 reads the open attempt and passes `BLOCKED_MESSAGE`; the action's `blocked` result stays the backstop.
- No DOM harness (epic 4): logic lives in `level-panel.ts`, and markup is checked by server render, as in 2.4/2.5. Visual fidelity in both themes is a manual check.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: clean.

**Manual checks (if no CLI):**
- Preview: /levels in dark and light theme at 1280px and 390px, compared side by side with `key-level-map.html` (panel frame and phone sheet rows). Then Start → exam screen and download. A second Start while the attempt is open → "Resume or abandon…" + link. Keyboard: `Tab` reaches only the Start button inside the panel.
