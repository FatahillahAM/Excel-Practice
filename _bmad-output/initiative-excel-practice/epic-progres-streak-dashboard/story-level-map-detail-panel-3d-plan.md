---
title: 'Level Map, Level Detail Panel lengkap, dan adegan 3D'
type: 'feature'
ticket: '5'
created: '2026-11-19'
status: 'in-progress'
route: 'full'
route_source: ''
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
baseline_revision: '9e839eddb43ea0183fbe4cd5d14a3fc65b6f38bc'
context: ['{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md', '{project-root}/_bmad-output/initiative-excel-practice/epic-progres-streak-dashboard/story-tracer-progres-level-path-plan.md', '{project-root}/_bmad-output/initiative-excel-practice/epic-progres-streak-dashboard/story-gerbang-test-practice-again-hp-plan.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/levels` hanya menampilkan panel satu level; belum ada Level Map penuh dengan keadaan node per progres, adegan 3D Scroll Scene, dan sisa P4 (eyebrow asli per keadaan, rekor waktu per baris) di Level Detail Panel (CAP-1, CAP-9, CAP-12, D3, Done when 1).

**Approach:** Level Map di `/levels` dari `levelProgress` (node passed / active / locked / Under Construction, Ujian Akhir dan side-track CAP-15 sebagai Under Construction) yang membuka Level Detail Panel yang sudah ada; gerbang tetap lewat `canStart`; adegan 3D CSS saja (`animation-timeline: scroll()`) sebagai salinan dekoratif `aria-hidden`/`inert` dengan frame statis untuk reduced motion, tanpa dukungan `animation-timeline`, dan Firefox. Tanpa migrasi.

## Boundaries & Constraints

**Always:**
- Keadaan node dan panel hanya dari `levelProgress`/`levelPanel`/`canStart` (AD-7); Dashboard Level Path dan Level Map memakai view model yang sama.
- Level Node: button, `Enter` membuka panel; active `aria-current="step"`; nama via `aria-labelledby` dari span terlihat; locked/UC membuka panel read-only dengan alasan di `aria-describedby` ("Pass Test Level N-1 to unlock."); side-track terakhir dalam urutan tab.
- Panel: eyebrow asli per keadaan (Active / Passed / Locked / Under Construction), Start Test / Test lulus / "Try the Test again" dari 4.3, skor terbaik dan waktu rekor per baris bila 4.4 sudah ada [ASSUMPTION: pakai `records()` dari 4.4; tanpa 4.4, kolom waktu ditunda]. Fokus: heading saat buka, node asal saat tutup; di HP sebagai bottom sheet.
- "Skip intro" elemen fokus pertama, lompat ke Level Path asli; peta, skor, dan daftar selalu di DOM.
- Gerak CSS saja (AD-12): `@supports (animation-timeline: scroll())` dan `prefers-reduced-motion: no-preference` mengaktifkan adegan; selain itu frame statis akhir (laptop terbuka, papan datar, node menyala sampai level aktif). Adegan menunggu data, tidak pernah memblokirnya.

**Never:**
- Library JS animasi/3D, WebGL, atau scroll listener JS. Menyimpan status gerbang. Konten Test/side-track asli (epic 5). Mengubah aturan gerbang 4.3. Deteksi Firefox lewat user-agent [ASSUMPTION: `@supports` saja sudah menutup Firefox].

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Akun baru | tanpa attempt | L1 active, L2–4 locked, L5–9 + Ujian Akhir + side-track UC | — |
| Level 2 aktif | Test L1 lulus | L1 passed, L2 active (`aria-current`) | — |
| Node terkunci | klik L3 | panel read-only + "Pass Test Level 2 to unlock." | Start tidak ada |
| Node UC | klik L5 | Tag Under Construction, tanpa Start | — |
| Test terbuka | 5 latihan L1 | panel "Start Test", eyebrow Active | — |
| V1 selesai | Test L4 lulus | L1–4 passed, baris akhir V1 | — |
| Reduced motion | `prefers-reduced-motion: reduce` | frame statis, tanpa animasi | — |
| Tanpa `animation-timeline` | Firefox / browser lama | frame statis | — |
| HP | coarse ≤1023px | peta + bottom sheet; Start menampilkan pesan HP (4.3) | — |
| Bacaan gagal | adapter error | alert muat-pertama + Try again, tanpa adegan | log `progress.load_failed` |

</frozen-after-approval>

## Code Map

- `src/app/(app)/levels/page.tsx` (+test) -- currently one panel for the active level; becomes the map.
- `src/app/(app)/levels/level-detail-panel.tsx`, `level-panel.ts` (+tests) -- panel + view model; eyebrow is still fixed "Active" (P4).
- `src/app/(app)/levels/start-control.tsx`, `start-lock.ts`, `start-actions.ts` -- Start/Practice again/phone gating; reuse as is.
- `src/app/(app)/dashboard/level-path.tsx` (+DOM test) -- Level Path nodes; extract shared Level Node.
- `src/core/progress/level-progress.ts` -- `levelProgress`, `canStart`, `CURRICULUM`, `FINAL_EXAM_NAME`.
- `src/core/content/__fixtures__/levels.ts` -- fixture modules for gate states.
- `src/app/globals.css` (+ `globals.test.ts`) -- existing scroll-timeline / static-frame rules (Results scene) to follow.
- `_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/mockups/key-level-map.html` -- visual + scroll ranges.

## Tasks & Acceptance

**Execution:**
- [ ] `src/components/levels/level-node.tsx` -- shared node (states, aria) used by Level Path and Level Map -- one implementation.
- [ ] `src/app/(app)/levels/level-map.tsx` (+DOM test) -- full path incl. Ujian Akhir and side-track UC; node opens panel; fixtures for each gate state.
- [ ] `src/app/(app)/levels/level-panel.ts`, `level-detail-panel.tsx` (+tests) -- real eyebrow, read-only locked/UC reason, record time per row, focus management, phone bottom sheet -- P4 leftovers.
- [ ] `src/app/(app)/levels/scroll-scene.tsx`, `globals.css` (+CSS/DOM test) -- decorative scene, Skip intro, static frame under reduced motion / no `animation-timeline` -- D3/AD-12.
- [ ] `src/app/(app)/levels/page.tsx` (+test) -- wire map, skeleton, failed read.
- [ ] `deferred-work.md` -- close the 2.6 Level Detail Panel entry (line 83) -- disposition.

**Acceptance Criteria:**
- Given fixture progress, when /levels renders, then every node shows its state and only the active node has `aria-current="step"`.
- Given reduced motion or no `animation-timeline` support, when /levels renders, then the scene shows the static end frame and nothing animates.
- Given the panel open from a node, when it closes, then focus returns to that node.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test` -- expected: pass incl. map/panel DOM tests and `globals.test.ts` static-frame checks.

**Manual checks (if no CLI):**
- /levels in Chrome (scene plays), Firefox (static frame), OS reduced motion (static frame), phone width (bottom sheet).

## Open Questions

- Does the Level Map replace the single-panel /levels or sit above it? Recommendation: replace; the panel opens from the node (desktop side panel, phone bottom sheet), default-open on the active level so today's flow keeps one click to Start.
- Should the 3D scene replay on every visit? Recommendation: yes, it is scroll-driven (no state); "Skip intro" covers repeat visits — no remembered skip.
- Sidebar "L3" count and footer "levels passed of 9" (EXPERIENCE › App Sidebar): include here? Recommendation: include if trivial from `levelProgress`, else defer to 4.6.
