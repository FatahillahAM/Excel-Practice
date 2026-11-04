---
title: 'Attempt Card: Resume, Abandon, dan kunci Start'
type: 'feature'
ticket: '7'
created: '2026-11-04'
status: 'in-progress'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
baseline_revision: '1535cb239c2aa643fed6c96aa253fbf8b3dbf52f'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Percobaan yang sedang berjalan tidak terlihat di mana pun: Dashboard masih placeholder tanpa Attempt Card, sehingga El Zavier tidak bisa Resume dari PC kantor atau membatalkan percobaan, dan Start di panel /levels tetap aktif lalu baru ditolak setelah ditekan ("Resume or abandon…").

**Approach:** Satu pembacaan server (sesi, RLS) atas percobaan `open`/`received`/`grading_failed` milik user dipakai Dashboard dan /levels. Dashboard merender Attempt Card (Resume = tautan ke `/exam/<id>`, Abandon = dialog konfirmasi → Server Action → `abandon()` adapter lewat `transition` AD-5); /levels mengisi `startLock` panel dengan alasan EXPERIENCE.md selama percobaan itu ada.

## Boundaries & Constraints

**Always:**
- Status hanya berubah lewat `abandon()` → `changeStatus` → `transition(from, "abandon")` (AD-5) dengan sesi user (AD-9); tanpa migrasi (policy `20261103000001` sudah mengizinkan open/received/grading_failed → abandoned, tes kontrak sudah ada).
- Satu fungsi baca percobaan terbuka untuk Dashboard, /levels, dan Start; kartu dan kunci berasal dari data server saat render, bukan state klien.
- Alasan kunci verbatim: "Resume or abandon the attempt in progress first." (`BLOCKED_MESSAGE`); tombol Start `aria-disabled`, tetap bisa difokus, alasan di `aria-describedby`. Hasil `blocked` dari action tetap ada sebagai pengaman.
- Attempt Card sesuai DESIGN.md (`attempt-card`, `key-dashboard.html`): "Attempt in progress", nama percobaan, waktu sejak Start dari server (AD-8), Primary "Resume" + outline "Abandon". Chrome English, kalimat sistem Indonesian `lang="id"` di `src/messages/id.ts`.
- Dialog: fokus terkunci di dialog, `Esc`/Cancel menutup tanpa perubahan, tombol Abandon nonaktif saat pending.

**Never:**
- Streak Hero, Level Path, rail Dashboard lainnya (epic 4); "Try again" penilaian gagal dan hint saat Resume (epic 3); pesan HP saat Start (epic 4).
- Abandon lewat route API, service role, atau update status di luar `changeStatus`; Realtime atau polling di Dashboard (AD-11: hanya layar exam yang polling).
- Migrasi baru; DOM test harness (epic 4).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Tanpa percobaan | tidak ada `open`/`received`/`grading_failed` | Dashboard tanpa Attempt Card; Start di /levels aktif | — |
| Open | percobaan `open` L01-P1 | Kartu "Practice 1 · Level 1", "mm:ss since Start", Resume + Abandon; Start /levels `aria-disabled` + alasan + "Go to the attempt" | — |
| Received / gagal nilai | `received` / `grading_failed` | Kartu sama, baris kedua "File received — grading…" sebagai ganti waktu; Start terkunci | — |
| Resume | klik Resume (laptop atau PC lain) | `/exam/<id>` percobaan yang sama: waktu dari server, "Download again" memberi byte yang sama | — |
| Abandon dikonfirmasi | open atau received, konfirmasi | status `abandoned`; Dashboard dirender ulang tanpa kartu; /levels Start aktif lagi | gagal DB → pesan di dialog, status tetap |
| Abandon dibatalkan | Cancel / `Esc` | dialog tertutup, fokus kembali ke "Abandon", tidak ada perubahan | — |
| Status berubah di tengah | Finish masuk (`open` → `received`) sebelum Abandon ditulis | CAS `lost` → baca ulang dan Abandon sekali lagi dari status baru | masih `lost`/`failed` → pesan, kartu tetap |
| Sudah selesai | percobaan sudah `graded`/`abandoned` (perangkat lain) | `refused`/`not_found` → render ulang; kartu hilang tanpa pesan error | — |
| Layar exam terbuka | perangkat lain Abandon | polling berikut melihat `abandoned`: polling berhenti, Orbit dan Dropzone hilang, "This attempt was abandoned." + tautan Dashboard | — |
| Baca gagal | query percobaan terbuka gagal | Dashboard: "Datanya belum kemuat. Coba lagi, ya." di slot kartu; /levels: Start tidak dikunci (action `blocked` jadi pengaman) | sudah di-log adapter |
| Tanpa sesi | sesi habis saat Abandon | redirect ke Login lalu kembali ke /dashboard | — |

</frozen-after-approval>

## Code Map

- `src/adapters/supabase/attempts.ts` (+test) -- `findOpenAttemptId` (id only), `readAttempt`, `abandon` (read → `changeStatus`, outcomes `changed|refused|lost|failed|not_found`), `ATTEMPT_COLUMNS`.
- `src/core/services/attempts/{lifecycle,elapsed}.ts` -- `transition`, `IN_PROGRESS_STATUSES`, `elapsedSeconds`.
- `supabase/migrations/20261103000001_attempts_abandon.sql`, `supabase/tests/contract.db.test.ts` -- owner abandon policy and its tests already exist; nothing to add.
- `src/app/(app)/dashboard/page.tsx` -- `PlaceholderPage`; becomes the first real Dashboard content.
- `src/app/(app)/levels/{page,level-detail-panel,start-control}.tsx`, `start-actions.ts` -- panel takes `startLock`; `StartControl.lock` renders `aria-disabled` + reason; `BLOCKED_MESSAGE`; action's `blocked` + "Go to the attempt". Page is static today.
- `src/app/(app)/exam/[attemptId]/{exam-status.tsx,exam-time.ts}` -- `POLLED` excludes `abandoned` (polling already stops); `statusLine` default "This attempt is closed."; `formatElapsed`.
- `src/components/ui/` -- `sheet.tsx` on `radix-ui` Dialog; no dialog component yet. `radix-ui` 1.8.1 ships `AlertDialog`.
- `src/messages/id.ts` -- `shellMessages.firstLoadFailed`, `startMessages.startFailed` pattern.

## Tasks & Acceptance

**Execution:**
- [x] `src/adapters/supabase/attempts.ts` (+test) -- `findOpenAttempt(supabase, userId): Read<Attempt | null>` (same filter as today, `ATTEMPT_COLUMNS`); `findOpenAttemptId` delegates to it -- one query for Dashboard, /levels and Start.
- [x] `src/app/(app)/open-attempt.ts` (+test) -- server-only `loadOpenAttempt()`: `getSessionUser` → `createClient` → `findOpenAttempt` → `{ attempt, title, elapsed } | null | "failed"` (title from `findItem`/`itemLabel` as on the exam page, `elapsedSeconds` at request time); pure `attemptCardView(attempt, elapsed)` → `{ title, line: "12:34 since Start" | "File received — grading…", resumeHref }` -- shared read and testable shape.
- [x] `src/components/ui/alert-dialog.tsx` -- shadcn new-york AlertDialog on `radix-ui` (role `alertdialog`, focus trap, `Esc`, focus back to trigger), CSS motion like `sheet.tsx` (AD-12), destructive action variant -- confirmation of a destructive action.
- [x] `src/app/(app)/dashboard/abandon-actions.ts` (+test) -- `"use server"` `abandonAttempt(prev, formData)`: session (else redirect to Login with `/dashboard`), `isAttemptId`, `abandon()`; `lost` → one retry; `changed`/`refused`/`not_found` → `revalidatePath("/dashboard")` + `revalidatePath("/levels")`, `{ status: "done" }`; `failed`/throw → `{ status: "error" }`; JSON log `attempt.abandoned` / `attempt.abandon_failed` (no tokens).
- [x] `src/app/(app)/dashboard/attempt-card.tsx` -- server card (DESIGN.md › Attempt Card) with `<Link>` Resume (Primary, Play icon) and client `AbandonButton` (outline) opening the dialog: title "Abandon this attempt?", body from `attemptMessages.abandonBody`, actions "Cancel" and destructive "Abandon" ("Abandoning…" while pending), error slot `role="alert"` `lang="id"`; on `done` the dialog closes and focus moves to the page `<h1>` (`tabIndex={-1}`).
- [x] `src/app/(app)/dashboard/page.tsx` (+`page.test.tsx`) -- async: `PageTitle` "Dashboard" + rail column with `AttemptCard` when `loadOpenAttempt()` gives one, first-load alert on `"failed"`, nothing else otherwise; full width on phone.
- [x] `src/app/(app)/levels/page.tsx` (+`page.test.tsx`) -- async: `loadOpenAttempt()`; attempt → `startLock = { reason: BLOCKED_MESSAGE, attemptId }`; `null`/`"failed"` → no lock.
- [x] `src/app/(app)/levels/start-control.tsx` -- `StartLock` gains optional `attemptId`: caption shows the reason plus "Go to the attempt" (`/exam/<id>`), as the `blocked` slot does; `lock` stays `{ reason }`-compatible with the 2.6 patch.
- [x] `src/app/(app)/exam/[attemptId]/exam-status.tsx` (+test) -- `statusLine("abandoned")` → "This attempt was abandoned."; for `abandoned`/`closed` a "Back to Dashboard" link under the line.
- [x] `src/messages/id.ts` -- `attemptMessages = { abandonBody: "Percobaan ini dibatalkan dan nggak dinilai. File-nya nggak bisa dikirim lagi, ya.", abandonFailed: <Login "network" row> }` (illustrative).
- [x] Tests -- matrix rows through `attemptCardView`, the action (mocked adapter: changed, lost→changed, lost→lost, refused, not_found, failed, throw, no session, bad id) and server render (`renderToStaticMarkup` of the awaited pages: card text, Resume `href="/exam/<id>"` without `?download=1`, Abandon trigger; /levels locked button `aria-disabled="true"`, reason, `aria-describedby`, link; no lock without attempt or on read failure).

**Acceptance Criteria:**
- Given an attempt started on the laptop, when the office PC opens Dashboard and presses Resume, then the exam screen of that attempt shows the time since Start and "Download again" returns the stored file.
- Given an `open` or `received` attempt, when Abandon is confirmed on Dashboard, then the card disappears, the row is `abandoned`, and "Start Practice 1" on /levels is enabled and starts a new attempt.
- Given the exam screen open on another device, when the attempt is abandoned, then within one poll it stops showing the Orbit and Dropzone, and a later Finish of that file is refused with `ATTEMPT_CLOSED`.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).

## Plan Change Log

## Review Triage Log

## Design Notes

- [ASSUMPTION] One read: `findOpenAttempt` behind `loadOpenAttempt()`, called per request by Dashboard and /levels (both become dynamic). The partial unique index gives at most one row, so `maybeSingle()` holds.
- [ASSUMPTION] Lock fails open on a read error: the database index still refuses a second attempt, and the action's `blocked` message is the backstop. It also covers a stale page rendered before an attempt started on another device.
- [ASSUMPTION] The lock caption adds "Go to the attempt" (the existing `blocked` link), because /levels has no Attempt Card; the mockup shows the reason line only.
- [ASSUMPTION] `AlertDialog`, not plain `Dialog`: DESIGN.md names shadcn `Dialog`, but a destructive confirm is an `alertdialog` (no scrim-click dismiss). Same visual tokens.
- [ASSUMPTION] Dialog copy is not decided in EXPERIENCE.md: title "Abandon this attempt?" and buttons English (chrome), body Indonesian (illustrative, like `startMessages`).
- [ASSUMPTION] The card's elapsed time is rendered once on the server (mockup shows a static value); the live clock is on the exam screen after Resume. `received`/`grading_failed` show "File received — grading…" instead, as the exam screen does.
- [ASSUMPTION] Resume is a plain link to `/exam/<id>`: the exam page already rehydrates from the server (2.4), and on a new device the file comes from "Download again" (same bytes, start time unchanged). No `?download=1`, so returning on the laptop does not download a second copy.
- `lost` retry: Finish can move `open` → `received` between the read and the CAS; `received` → `abandoned` is an AD-5 edge, so one retry from the new status is correct; a second `lost` is reported.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: clean; CI job `db-contract` green (unchanged).

**Manual checks (if no CLI):**
- Preview: Start on /levels → Dashboard shows the card; /levels Start disabled with reason (Tab reaches it, screen reader reads the reason). Second browser (other device): Resume → same exam screen and time; Download again → same file. Abandon → dialog (Tab trapped, `Esc` closes) → confirm → card gone, /levels Start enabled; the first browser's exam screen shows "This attempt was abandoned." within 2 s. Repeat with the attempt in `received`. Dark and light theme, 390px width.
