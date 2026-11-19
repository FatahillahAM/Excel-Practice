---
title: 'Streak, freeze, migrasi `freezes`, dan Streak Hero'
type: 'feature'
ticket: '2'
created: '2026-11-19'
status: 'draft'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/DESIGN.md', '{project-root}/_bmad-output/initiative-excel-practice/epic-progres-streak-dashboard/story-tracer-progres-level-path-plan.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Belum ada streak, freeze, atau tanda "hari ini belum aman", jadi alasan kembali setiap hari (CAP-10) tidak ada; tabel `freezes` belum ada dan cek `attempts_result_only_when_graded` masih menyimpan izin mati `closed`+result (P1). Bergantung pada 4.1 (bacaan adapter bersama dan `toGradedAttempts`).

**Approach:** Satu migrasi (tabel `freezes` + RLS, dan pengetatan cek P1), Server Action Use freeze, fungsi murni `streak()` dan `freezesLeft()` atas tanggal lokal di `profiles.time_zone`, dan Streak Hero (Freeze Pill, Week Strip, Streak Risk Pill dengan sisa waktu) di rail Dashboard dan layar pertama HP, dirender server.

## Boundaries & Constraints

**Always:**
- Hari = tanggal lokal `received_at` attempt `graded` (skor berapa pun, termasuk Practice again) di `profiles.time_zone`; minggu = ISO Senin–Minggu di zona itu; "sekarang" = jam server (AD-8).
- Streak = jumlah hari berturut-turut berakhir di hari ini (bila aman) atau kemarin (bila hari ini belum aman), di mana tiap hari punya attempt graded atau freeze; hari terlewat tanpa freeze mereset ke 0.
- Freeze: baris `freezes(user_id, local_date)`, unik per (user, tanggal); hanya untuk hari ini di zona user; maks 2 per minggu ISO, sisa tidak terbawa; ditolak bila hari ini sudah punya attempt graded atau sudah di-freeze. Aturan ditegakkan di server action DAN di DB (fungsi `security definer` atau cek/trigger) agar freeze mundur/ke-3 ditolak untuk semua role.
- RLS owner-only; sesi user boleh `select` miliknya; insert hanya lewat jalur yang menegakkan aturan. Tidak ada update/delete.
- Migrasi diterapkan orkestrator ke `dev` lalu `prod` sebelum deploy (AD-13); tidak ada edit dashboard.
- P1: cek menjadi `result is null or status = 'graded'`; jalur saat ini tidak pernah menulis `closed`+result.
- Streak Hero: state safe / at risk / frozen today / zero; at risk → numeral desaturasi (≥3:1), Risk Pill "Xh Ym left" sampai 00:00 lokal, Freeze Pill jadi "Use freeze"; kuota habis → `aria-disabled` + alasan di `aria-describedby`. Hitung mundur tidak diumumkan per detik. Di HP numeral final tampil ≤0,5 detik (server-rendered, tanpa count-up).

**Never:**
- Freeze otomatis, freeze mundur/maju, mengubah `time_zone`, menyimpan streak atau sisa freeze di tabel (AD-7).
- Pesan "streak restarted" sekali-tampil [ASSUMPTION ditunda ke 4.6 bila butuh penyimpanan], Records, Activity Chart, History List di rail, gerak masuk sinematik desktop.
- Klien menentukan "hari ini".

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Aman hari ini | graded hari ini + 2 hari sebelumnya | streak 3, safe | — |
| Belum aman | graded kemarin dan lusa, hari ini kosong | streak 2, at risk, "Xh Ym left" | — |
| Terlewat | graded 3 hari lalu saja | streak 0 | — |
| Freeze menjembatani | graded Sen, freeze Sel, graded Rab | streak 3 | — |
| Tengah malam | graded 23:59:59 lokal vs 00:00:00 | hari berbeda sesuai zona | — |
| DST | zona dengan DST (fixture `America/New_York`), hari 23/25 jam | satu hari lokal tetap satu hari; sisa waktu benar | — |
| UTC vs lokal | `received_at` 2026-11-18T18:00Z, zona `Asia/Jakarta` | dihitung 19 Nov | — |
| Reset Senin | 2 freeze minggu lalu | minggu ini 2 of 2 left | — |
| Use freeze | at risk, kuota 1 | baris freeze hari ini, frozen today, 0 of 2 | — |
| Freeze ke-3 | 2 freeze minggu ini | ditolak | pesan alasan; DB menolak juga |
| Hari sudah aman | graded hari ini | tombol tidak tampil; action ditolak | ditolak di server |
| Freeze mundur | insert `local_date` kemarin langsung | ditolak DB | 23514 / pesan |
| Ganda | dua klik cepat | satu baris (unik) | kedua dianggap sudah frozen |
| Zona hilang | `time_zone` null | Streak Hero pesan muat pertama | log `streak.time_zone_missing` |

</frozen-after-approval>

## Code Map

Adjust once 4.1 lands (names of the shared read and `toGradedAttempts` may differ).

- `supabase/migrations/20261109000001_attempts_result.sql`, `20261110000001_attempts_status_fence.sql` -- current check + header note on the dead allowance; `20261113000001_hint_reveals.sql` -- security-definer + fence pattern to copy.
- `supabase/migrations/20261029000003_auth_profiles.sql` -- `time_zone` (immutable, validated).
- `src/adapters/supabase/profiles.ts` -- `readTimeZone`; `hints.ts` -- rpc adapter pattern; `migrations.test.ts` -- migration listing test.
- `src/core/progress/level-progress.ts` (4.1) -- `GradedAttempt`; add `streak.ts`.
- `src/app/(app)/dashboard/page.tsx` -- rail (Attempt Card first; Streak Hero after it on desktop, before it on phone per EXPERIENCE); `abandon-actions.ts` -- server action pattern.
- `src/messages/id.ts`, `src/test/dom.ts`.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/2026112xxxxxx_freezes.sql` -- `freezes` table (uuid id, user_id → profiles, local_date date, created_at), unique (user_id, local_date), RLS owner select, no direct insert/update/delete for `authenticated`; `use_freeze()` security definer computing today in the user's zone and enforcing today-only / not-safe / ≤2 per ISO week under a row lock; drop and re-add `attempts_result_only_when_graded` as `result is null or status = 'graded'`.
- [ ] `src/adapters/supabase/freezes.ts` (+test) -- `listFreezes(supabase, userId)`, `useFreeze(supabase)` mapping refusals to typed reasons.
- [ ] contract DB tests -- backdated/3rd/safe-day freeze refused for every role; owner-only reads; P1 check refuses `closed`+result.
- [ ] `src/core/progress/streak.ts` (+`.test.ts`) -- `localDate(instant, zone)`, `streak({attempts, freezes, now, zone})` → `{count, todaySafe, frozenToday, msLeft, week: DayState[7]}`, `freezesLeft({freezes, now, zone})`; table tests for the matrix.
- [ ] `src/app/(app)/dashboard/freeze-actions.ts` (+test) -- Server Action: session, call adapter, revalidate.
- [ ] `src/app/(app)/dashboard/streak-hero.tsx` -- numeral, Freeze Pill / Use freeze, Week Strip with full day names, Risk Pill; static countdown text from server `msLeft` [ASSUMPTION: minute-level client tick without announcements].
- [ ] `src/app/(app)/dashboard/page.tsx` -- rail order desktop/phone.
- [ ] `src/app/(app)/dashboard/streak-hero.dom.test.tsx` -- safe / at risk / frozen / zero / quota used.

**Acceptance Criteria:**
- Given the migration applied to dev then prod, when deployed, then `migrations.test.ts` and `test:db` pass and the Production Dashboard shows Streak Hero.
- Given a phone viewport, when the Dashboard loads, then the streak numeral is in the server HTML (no client fetch).

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

- DB enforcement via a security-definer function mirrors `reveal_hint`; computing "today" in SQL (`now() at time zone p.time_zone`) keeps one clock (AD-8). The TS `streak()` uses `Intl.DateTimeFormat` with the zone for display only; tests pin both to the same fixtures.
- [ASSUMPTION] Streak spans all graded history (from 4.1's read), not a window.

## Open Questions

- "Streak restarted" one-time message needs memory of having shown it (no storage allowed by AD-7 except freezes). Recommendation: show it derived — "restarted" whenever count is 1 and a non-zero streak ended yesterday-but-one — no stored flag; or defer to 4.6.
- Should "Use freeze" be offered on a day with zero streak? Recommendation: yes (spec doesn't forbid; quota is the limit), but deprioritise visually.

## Verification

**Commands:**
- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:db`, `npm run build` -- expected: all pass, none skipped

**Manual checks:**
- Orchestrator applies the migration to `dev` then `prod` before merge-deploy; Production Dashboard: at-risk state with time left, Use freeze works on the phone, third freeze refused.
