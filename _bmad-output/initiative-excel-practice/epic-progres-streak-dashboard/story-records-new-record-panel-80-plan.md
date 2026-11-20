---
title: 'Records, "New record" di Results, dan panel ≥80'
type: 'feature'
ticket: '4'
created: '2026-11-19'
status: 'in-review'
route: 'full'
route_source: ''
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: 'be8f65a668f943b5ae7204b42255fef262ef78df'
context: ['{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md', '{project-root}/_bmad-output/initiative-excel-practice/epic-progres-streak-dashboard/story-tracer-progres-level-path-plan.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Waktu terbaik per item belum dihitung di mana pun: halaman Records masih placeholder, Results tidak menandai "New record", dan gaya panel ≥80 dari mockup belum dibangun (CAP-11, P2, Done when 4).

**Approach:** Fungsi murni `records()` di `src/core/progress` atas bacaan bersama `listProgressAttempts` (durasi `received_at − started_at`, terbaik per item, latihan dan Test terpisah karena item id berbeda); halaman Records menggantikan placeholder; Results membandingkan attempt saat ini dengan attempt graded sebelumnya untuk badge "New record"; polesan panel ≥80 (tint `glow-soft`, gradien + cincin inset koin, border `glow` saat hover). Tanpa migrasi.

## Boundaries & Constraints

**Always:**
- Rekor diturunkan dari attempt `graded` dengan Result valid (`toGradedAttempts`), tanpa kolom/counter tersimpan (AD-7). Skor berapa pun dihitung, termasuk Practice again dan Test gagal (EXPERIENCE J4 failure).
- Durasi = detik bulat `received_at − started_at`, sama dengan `elapsed.ts` yang dipakai Results [ASSUMPTION: reuse helper finished-duration yang ada, bukan rumus baru].
- "New record" hanya bila attempt ini lebih cepat secara ketat dari rekor terbaik sebelumnya untuk item yang sama; attempt pertama sebuah item tidak pernah ditandai; seri tidak ditandai.
- "Sebelumnya" = attempt graded dengan `received_at` lebih awal (tie: `id`), sehingga membuka Results lama tetap menunjukkan badge yang benar secara historis [ASSUMPTION].
- Records: satu baris per item yang punya rekor (waktu terbaik, tanggal, skor attempt itu), dikelompokkan per level; Practice again per baris lewat jalur Start yang sama (`canStart`); empty state satu baris + link ke Dashboard; Skeleton saat loading; bacaan gagal → alert muat-pertama + Try again.
- Badge "New record" di samping waktu (EXPERIENCE › Results); polesan ≥80 hormat `mode="static"` / reduced motion (hover border tetap, tanpa animasi).

**Never:**
- Migrasi, tabel records, atau cache (AD-7). Records Card di rail Dashboard [ASSUMPTION: di luar tiket ini; lihat Open Questions]. Ujian Akhir di Records (belum ada konten). Mengubah grader, pips, atau gerbang.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Attempt pertama | L01-P1 graded 300 dtk, tanpa riwayat | rekor 300, tanpa "New record" | — |
| Lebih cepat | rekor 300, attempt baru 250 | rekor 250, Results "New record" | — |
| Lebih lambat / seri | rekor 250, attempt 250 atau 280 | rekor tetap, tanpa badge | — |
| Practice again | L01-P1 selesai, Practice again 200 | rekor 200 + badge; pips tetap | — |
| Latihan vs Test | L01-P1 dan L01-T | dua rekor terpisah | — |
| Test gagal | L01-T skor 60, 180 dtk | tetap dihitung rekor | — |
| Results lama | buka Results attempt 300 setelah 250 ada | badge sesuai riwayat saat itu (pertama → tidak) | — |
| Data tak lengkap | `received_at` null / Result tak valid | diabaikan | — |
| Kosong | belum ada attempt graded | empty state + link | — |
| Bacaan gagal | adapter error | alert muat-pertama + Try again | log `progress.load_failed` |

</frozen-after-approval>

## Code Map

- `src/core/progress/level-progress.ts` -- `toGradedAttempts` / `GradedAttempt` (carries `startedAt`/`receivedAt`?); records builds on it.
- `src/core/progress/index.ts` -- export surface.
- `src/core/services/attempts/elapsed.ts` -- finished duration helper (Results time).
- `src/adapters/supabase/attempts.ts` -- `listProgressAttempts` / `ProgressAttemptRow` (`startedAt`, `receivedAt`); no new query expected.
- `src/app/(app)/progress.ts` -- shared loader (`loadProgress`); add records loading beside it.
- `src/app/(app)/records/page.tsx` -- placeholder to replace.
- `src/app/(app)/results/load-result.tsx`, `[attemptId]/page.tsx` -- Results data; pass newRecord.
- `src/components/results/results-view.tsx`, `results-details.tsx`, `score-badge.tsx`, `outcome.ts` -- time display, Outcome panel, coin.
- `src/app/(app)/levels/start-control.tsx`, `start-lock.ts` -- Practice again control reused per Records row.
- `src/app/globals.css` -- tokens `glow`, `glow-soft`.

## Tasks & Acceptance

**Execution:**
- [x] `src/core/progress/records.ts` (+test) -- pure `records(attempts)` → best per item; `isNewRecord(attempts, attemptId)` (strictly faster than every earlier graded attempt of the item) -- single derivation for both surfaces; table tests cover the matrix.
- [x] `src/app/(app)/progress.ts` -- `loadRecords()` reusing the same read -- one source, no extra query.
- [x] `src/app/(app)/records/page.tsx` (+ `records-list.tsx`, DOM test) -- list per level, Practice again, empty/loading/failed -- replaces placeholder.
- [x] `src/app/(app)/results/load-result.tsx` / `results-view.tsx` (+DOM test) -- "New record" badge next to time; failed progress read hides the badge silently [ASSUMPTION] -- Results must still render.
- [x] `src/components/results/*`, `globals.css` (+DOM/CSS test) -- ≥80 panel polish (P2) -- deferred-work line 159.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- mark P2 entry done -- disposition.

**Acceptance Criteria:**
- Given a graded attempt faster than the previous best, when its Results opens, then "New record" sits next to the time; given the first attempt of an item, then no badge.
- Given attempts across levels, when Records opens, then each item shows its best time once, practices and Test as separate rows, with Practice again obeying `canStart`.
- Given score ≥80, when Results renders, then the Outcome panel has the glow-soft tint, coin gradient/ring and hover glow border; in static mode nothing animates.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `GradedAttempt` gained `id` (tie-break for "earlier"); test literals in progress/levels tests updated accordingly.
- `progress.ts`: one private `loadGradedAttempts()` behind `loadProgress`, `loadRecords` and `loadNewRecord` (no extra query); a failed read hides the badge.
- Records rows in curriculum order; Practice again via `StartControl` + `canStart` ("Try the Test again" for a failed Test), locked by an open attempt as on /levels; no button when `canStart` refuses. No Dashboard Records Card.
- "New record" shown on live Results only (History detail passes nothing); only beside a time.
- ≥80 polish: `PASS_PANEL` (tint + `hover:border-glow`, both modes; border transition only live, `motion-reduce:transition-none`) and `COIN` face on the glowing (live pass) badge; static badge stays flat. New copy `shellMessages.recordsEmpty` (illustrative).

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test` -- expected: pass, incl. new core and DOM tests.

**Manual checks (if no CLI):**
- Records page and a Results page with/without the badge at desktop and phone widths.

## Open Questions

- Records Card on the Dashboard rail (EXPERIENCE › Dashboard): add here or leave to a later ticket? Recommendation: leave out; tiket 4 lists only the page, badge and panel — add a small card only if the user wants it in 4.4.
- Should a Test that failed count for a record? Recommendation: yes (EXPERIENCE J4: "the time still counts for Records").
- Records sort order within a level. Recommendation: curriculum order (P1–P5, then Test), not by time.
