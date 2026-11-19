---
title: 'Refactor sweep'
type: 'feature'
ticket: '10'
created: '2026-11-18'
status: 'in-review'
route: ''
route_source: ''
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: '35ee36766b44a568c5aece017f1a528356ed749c'
context: ['{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic penilaian menyisakan 21 entri `open` di `deferred-work.md` dari plan 3.1–3.8, dua entri epic 2 yang dipindah ke epic ini (`moved — epic 3`, sweep 2.11), dan dua temuan review yang hanya ada di Review Triage Log 3.3 (#11 izin `graded → closed` yang mati di migrasi 20261109, #13 jangkar pesan lambat reset saat reload). Tanpa disposisi, epic tidak bisa ditutup dan epic 4/5 tidak melihat pekerjaan yang diwarisi.

**Approach:** Pekerjaan ini hanya pembersihan dan pembukuan, tanpa perilaku baru:
- **Disposisi:** setiap entri di atas mendapat satu disposisi (diperbaiki di sweep ini, dipindah ke epic/story bernama dengan alasan, atau ditutup dengan bukti), dicatat sebagai baris `status:` di `deferred-work.md` dan sebagai Parked Notes di epic tujuan.
- **Perbaikan kecil:** hanya yang tidak mengubah tampilan, skor, alasan, atau status yang dilihat user — saat ini satu kandidat: cek registry bahwa id Tip yang sama di dua level punya isi yang sama (bila 3.9 belum menambahkannya).
- **Perapian kode:** duplikasi atau kode mati di kode epic 3 yang ditunjuk catatan build, dicek ulang terhadap `main` setelah 3.9 di-merge.

## Boundaries & Constraints

**Always:**
- Tidak ada perubahan yang terlihat user: teks, skor, alasan, Tip, route, status percobaan, dan bentuk `Result`/snapshot tetap; jumlah tes tidak turun dan tidak ada tes yang di-skip.
- Bukti untuk entri "closed" bisa diperiksa: commit, tes, migrasi terpasang, atau baris Decision di epic.
- Entri yang mengubah penilaian (skor/alasan) atau tampilan dipindah, bukan diperbaiki di sini.

**Never:**
- Migrasi, perubahan grant/RLS/trigger, atau perubahan setelan Supabase/Vercel (item yang butuh migrasi dipindah).
- Mengubah `normalizeFormula`, pembacaan sel, atau pemeriksa sehingga skor berubah; mengubah konten L01-P1.
- Fitur baru: gaya panel ≥80, `<code lang="en">`, kebijakan hapus Storage, lapisan tes browser.
- Menyentuh plan 3.9 atau 3.11.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Registry konsisten | Semua level di registry, id Tip unik atau sama isi | Tes registry lulus | Tidak ada error |
| Id Tip bentrok antar level | Fixture dua level, id sama, isi beda | Tes cek registry gagal dengan nama id dan kedua level | Pesan menyebut id Tip |
| Entri tertunda dibaca | Setiap entri `source_plan` epic 3 + dua entri `moved — epic 3` | Masing-masing punya `status:` sesuai tabel disposisi | — |
| Sesudah sweep | Halaman Results, History, Exam | Render dan tes identik dengan sebelum sweep | — |

</frozen-after-approval>

## Code Map

- `_bmad-output/implementation-artifacts/deferred-work.md` -- lines 57–67 (two `moved — epic 3` entries from 2.11), 104–183 (epic-3 entries; 101 and 125 already `done`).
- `_bmad-output/initiative-excel-practice/epic-penilaian-hasil-tips/epic-penilaian-hasil-tips.md` -- Notes › Parked (epic 2) and Decisions U5, U7, 3.3–3.8; add Decision 3.10.
- `epic-progres-streak-dashboard/`, `epic-konten-level-1-4/`, `epic-ujian-akhir/` epic files -- targets for Parked Notes.
- `story-penilaian-gagal-try-again-pagar-ad-5-dan-harness-dom-plan.md` › Review Triage Log #11, #13 -- the two triage-only deferrals.
- `src/content/levels/index.ts` (+ `index.test.ts`) -- registry; place for the cross-level Tip-id check (only if 3.9 did not add one).
- `src/app/(app)/results/load-result.tsx`, `src/app/(app)/history/history-rows.ts` -- both `resultSchema.safeParse` a stored Result with their own drop/log path; check for a shared helper only if the duplication is more than the parse call (leave as is otherwise).
- `src/components/shell/page-title.tsx` -- `PlaceholderPage`; after 3.9 only `/records` (epic 4) should use it — keep the component, remove nothing else.
- `supabase/migrations/20261109000001_attempts_result.sql` / `20261110000001_attempts_status_fence.sql` -- the dead `graded → closed` allowance (header of 20261110 documents it); do not edit.
- Do not change: `src/core/grading/formula.ts`, `workbook-reading.ts`, `checkers.ts`, `src/components/results/*` visuals, `exam-status.tsx` timing.

## Tasks & Acceptance

**Execution:**
- [x] (first) Re-check scope against `main` after 3.9 merges -- update the disposition table: 3.9 may have closed the Tip-id entry (#6) and changed Tips dedupe (#16); grep epic-3 code for unused exports (`npx tsc --noEmit` + a search for exports with no importer under `src/core/grading`, `src/components/results`, `src/app/(app)/{exam,results,history,tips}`, `src/adapters/supabase`) and add only removals that are dead and behaviour-free.
- [x] `src/content/levels/index.ts` + `index.test.ts` -- if 3.9 did not: registry check that one Tip id maps to one content across all levels, with a test on a two-level fixture -- closes #6 without changing live content.
- [x] Dead code found in the re-check -- remove, with the test count unchanged.
- [x] `deferred-work.md` -- one `status:` line per entry per the table (`done — …`, `moved — <epic/story> (reason)`, or `closed — <evidence>`), suffix `(sweep 3.10, <date>)`.
- [x] Target epic files -- Parked Notes for moved entries; `epic-penilaian-hasil-tips.md` gets Decision 3.10 with the counts.

**Acceptance Criteria:**
- Given `deferred-work.md` after the sweep, when every epic-3 entry and the two `moved — epic 3` entries are read, then none is `open` and each status matches the table.
- Given each moved entry, when its target epic file is read, then a Parked Note names it.
- Given the full verification, then counts of tests are equal or higher and none are skipped.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Re-check after 3.9: #6 already fixed by 3.9 (`assertTipsAgreeAcrossLevels` in `src/content/levels/index.ts`, deferred entry already `done`) — not redone. Unused-export scan of the listed dirs found no truly dead code (every flagged export is used in its own file or by tests), so no product code changed.
- `deferred-work.md`: all epic-3 entries and the two `moved — epic 3` entries have a `status:` line with `(sweep 3.10, 2026-11-19)`; triage-only #22/#23 added as new entries; `status: open` count is 0.
- Parked Notes: epic 4 (#13, #22), epic 5 (#2, #3, #4, #12, #14, #15), epic Ujian Akhir (#7), initiative Notes post-V1 (#20); browser checks for 3.11 (#11, #16) are a Parked Note in the epic file, not in the 3.11 plan (Never: do not touch plan 3.11). Decision 3.10 counts added to the epic file.
- Checks (no code changed): lint, `tsc --noEmit`, `npm test` pass; build and `test:db` not run (no code or migration change).

## Plan Change Log

## Review Triage Log

## Design Notes

- Scope is re-checked against `main` after 3.9 (Tips & Tricks) merges, before any edit: 3.9 owns the Tips collection, which the Tip-id entry (#6) and the duplicate-Tip entry (#16) point at, and it replaces `/tips`' `PlaceholderPage`.
- [ASSUMPTION] Grading-edge entries (#2–#4) change scores or reasons, so they are not cleanup; they go to epic 5 (konten Level 1–4), where real content first meets those formula shapes.
- [ASSUMPTION] Browser-only checks (#13, #17) move to 3.11 (uji Production) as manual checks; there is no browser test layer, and adding one is a feature.

**Disposition table** (evidence as of 2026-11-18; re-checked after 3.9):

| # | Entry (source) | Disposition | Evidence or reason |
|---|---|---|---|
| 1 | Partly applied migration 20261109 untested (3.1) | closed | Migrations applied whole via MCP, dev → prod (AD-13); 20261109 and 20261110 live (Decisions 3.1, 3.3) |
| 2 | Intersection operator merged by `normalizeFormula` (3.2) | moved → epic 5 | Changes grading results; decide with content that uses it |
| 3 | `_xludf.` not stripped (3.2) | moved → epic 5 | Changes reason text; V1 targets Excel 2021 |
| 4 | `t="str"` empty cache → `wrong_value` (3.2) | moved → epic 5 | Changes reason; non-Excel writers only |
| 5 | v1 snapshot loops on Try again (3.4) | closed | Decision 3.4: prod had no running attempt before merge; new attempts write v2 |
| 6 | Tip id unique only within a level (3.4) | fix here (or closed by 3.9) | Registry check + test; no content change |
| 7 | Hints required when `hintQuota` 0 (3.4) | moved → epic Ujian Akhir | Only the final exam has quota 0 |
| 8 | Code before migration 20261113 breaks grading (3.5) | closed | Migration live dev + prod (Decision 3.5); AD-13 order is the standing guard |
| 9 | Rows past the fence → `hintsUsed > quota` (3.5) | closed | Unreachable while the trigger is on; restores disable triggers by design (3.3 #14) |
| 10 | Fractional jsonb numbers in hand-written snapshots (3.5) | closed | App writes integers only (`examSnapshotSchema`) |
| 11 | Results browser-only behaviour untested (3.6) | moved → 3.11 | Manual Production checks; no browser test layer |
| 12 | `<code lang="en">` on Excel terms (3.6) | moved → epic 5 | Needs markup in the content contract |
| 13 | ≥80 panel mockup styling (3.6) | moved → epic 4 (needs user decision) | New visuals, not cleanup |
| 14 | Same Tip id → two cards on Results (3.6) | moved → epic 5 | Frozen one-card-per-question rule; revisit with content reuse |
| 15 | Removed Test item loses heading (3.6, also History) | moved → epic 5 | Test items exist only in epic 5 |
| 16 | Results motion browser-only (3.7) | moved → 3.11 | Manual checks, as #11 |
| 17 | Save-Data keeps turn/fire (3.7) | closed | AD-12 limits only scenes; accepted in 3.7 |
| 18 | `page-enter` on static History (3.8) | closed | Global transition, reduced motion turns it off; accepted in 3.8 |
| 19 | Same-minute History dates (3.8) | closed | Accepted format; one user |
| 20 | Orphan `attempt-files` / `submission-1` (2.1, moved → epic 3) | moved → post-V1 (needs user decision) | U7: cleanup deferred; files kept for regrading |
| 21 | DB does not fence service-role status writes; CAS `lost` (2.2, moved → epic 3) | closed | Migration 20261110000001 status fence + `grading_requested_at` CAS (3.3) |
| 22 | Dead `graded → closed` allowance (3.3 triage #11) | moved → epic 4 | Needs a migration; fold into epic 4's first attempts migration |
| 23 | Slow-message anchor resets on reload (3.3 triage #13) | closed | Cosmetic, accepted in 3.3; a fix changes visible timing |

## Open Questions

1. ≥80 panel styling (#13): move to epic 4 (Results polish beside "New record"), to epic 5, or close as won't-do?
2. Orphan `attempt-files` (#20): no V1 epic owns Storage cleanup. Move to a post-V1 backlog note in the initiative file, or to epic Ujian Akhir as the last V1 epic?

## Verification

**Commands:**
- `npm run lint` -- expected: clean.
- `npx tsc --noEmit` -- expected: no errors.
- `npm test` -- expected: all pass, count equal or higher, no skipped tests.
- `npm run build` -- expected: success.
- `npm run test:db` -- expected: all pass (no migration changed).

**Manual checks:**
- `grep -c 'status: open' deferred-work.md` restricted to epic-3 source plans -- expected: 0.
