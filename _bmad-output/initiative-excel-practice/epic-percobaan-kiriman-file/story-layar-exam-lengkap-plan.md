---
title: 'Layar exam lengkap'
type: 'feature'
ticket: '4'
created: '2026-11-03'
status: 'draft'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Layar exam tracer hanya kartu status dan polling: belum ada waktu sejak Start, Orbit Loader, pesan penilaian lambat, tautan Setup Guide, dan tata letak `key-exam.html`.

**Approach:** Halaman server menghitung waktu dari `started_at` (AD-8) dan merender kolom tengah: Orbit Loader, Exam Status Line, tautan Setup Guide. Klien menambah detik lokal dan menjangkar ulang dari `elapsedSeconds` tiap polling; muat ulang selalu mulai dari state server.

## Boundaries & Constraints

**Always:**
- Waktu = server; klien hanya menambah detik sejak jangkar terakhir, tak pernah membandingkan jamnya dengan `started_at`.
- Waktu tidak masuk live region (`role="status"`): tidak diumumkan tiap detik.
- Orbit = inline SVG + CSS keyframes (AD-12), `aria-hidden`, geometri DESIGN.md; reduced motion = frame diam di sudut awal.
- Teks Indonesian di `src/messages/id.ts`, verbatim dari EXPERIENCE.md, `lang="id"`.
- "Download again" = `GET /exam/<id>/download` yang sudah ada; tidak menulis ke `attempts`.

**Never:**
- Upload Dropzone (entry 5; tempatnya disisakan tanpa elemen kosong), hint, "Try again" dan pindah ke Results (epic 3), Attempt Card (entry 7), isi Setup Guide (entry 10), Exam Timer (Next).
- Mengubah respons endpoint status, Realtime, library animasi, DOM test harness (epic 4).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Baru Start | `open`, 5 s sejak Start | "Excel is open — Practice 1 · 00:05", instruksi Finish, "Download again" | — |
| Muat ulang / Resume | `open`, 12 m 34 s | render server langsung 12:34, lalu lanjut berdetik | baca gagal → first-load alert (sudah ada) |
| Polling | `elapsedSeconds` ≠ tampilan | dijangkar ulang ke server | fetch gagal → tetap berdetik |
| ≥ 1 jam | 3 725 s | "1:02:05" | — |
| Received < 15 s | `received` | "File received — grading…", tanpa waktu, Orbit jalan | — |
| Penilaian lambat | ≥ 15 s di `received` (saat muat ulang: dari `received_at`) | + "Penilaian agak lama, tunggu sebentar ya." | — |
| Gagal dinilai | `grading_failed` | baris grading tanpa pesan lambat | "Try again" = epic 3 |
| Unduh ulang | dua `GET` download | SHA-256 byte sama; `started_at` tetap | bukan pemilik → 404 |
| Reduce motion | OS atau Settings | Orbit diam, tombol pause tidak dirender | — |
| Pause/play | klik tombol | dot berhenti/lanjut; label "Pause animation"/"Play animation" | — |

</frozen-after-approval>

## Code Map

- `src/app/(app)/exam/[attemptId]/page.tsx` -- sesi + `readAttempt`, `PageTitle` dalam kartu; first-load alert dan skeleton tetap.
- `src/app/(app)/exam/[attemptId]/exam-status.tsx` -- unduh `?download=1`, polling 2 s, berhenti di 401/404.
- `src/app/api/attempts/[attemptId]/status/route.ts` -- `elapsedSeconds` dihitung inline.
- `src/adapters/supabase/attempts.ts` -- `Attempt.startedAt`/`receivedAt` (ISO).
- `src/hooks/use-motion-preference.ts` -- `"reduce"` saat SSR/hidrasi.
- `src/app/globals.css` -- aturan reduced motion global (`animation: none`).
- `src/components/shell/{logo,nav-items}.tsx` -- glyph `LogoTile`; `/setup-guide`, ikon `BookOpen`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/core/services/attempts/elapsed.ts` (+ `index.ts`) -- `elapsedSeconds(fromIso, nowMs)`: bulat, ≥ 0, ISO rusak → 0 -- satu rumus AD-8 untuk route dan halaman; route memakainya, respons tetap.
- [ ] `src/messages/id.ts` -- `examMessages.finishHint` (pindahan `FINISH_HINT`), `gradingSlow`.
- [ ] `src/app/(app)/exam/[attemptId]/exam-time.ts` -- murni: `formatElapsed` (`mm:ss`, ≥ 1 jam `h:mm:ss`), `elapsedAt(base, anchorMs, nowMs)`, `SLOW_GRADING_S = 15`, `isGradingSlow(status, secondsInReceived)`.
- [ ] `src/components/exam/orbit-loader.tsx` + `globals.css` -- SVG 320px per DESIGN.md › Orbit Loader (6 cincin, satu dot per cincin, sudut awal 0/90/180/0/270/90°, pusat glyph logo); `@keyframes` + durasi 44/40/36/14/16/15 s; tombol ghost kanan bawah men-toggle `data-paused` → `animation-play-state: paused`, tidak dirender saat `useMotionPreference()` = `reduce`.
- [ ] `src/app/(app)/exam/[attemptId]/exam-status.tsx` -- props `initialElapsed`, `initialReceivedSeconds`; interval 1 s hanya saat `open`; jangkar received = nilai server atau 0 saat transisi terlihat lewat poll. Live region: baris 1 + instruksi + pesan lambat; waktu (`font-mono tabular-nums`) sebaris di luarnya. Orbit selama status dipolling.
- [ ] `src/app/(app)/exam/[attemptId]/page.tsx` -- kolom tengah tanpa kartu: h1 `sr-only` "Level 1 · Practice 1, in progress", ExamStatus, lalu "Finish not working? Setup Guide" (`/setup-guide`). Hitung detik dari `startedAt`/`receivedAt` setelah baca sesi. Dropzone entry 5 nanti di antara status line dan tautan.
- [ ] Tes -- helper: tiap baris waktu/lambat di matriks; `page.test.tsx` (`vi.setSystemTime`): 12:34 dari `startedAt`, waktu di luar `role="status"`, SVG `aria-hidden`, tanpa tombol pause di SSR, pesan lambat untuk `received_at` 20 s lalu (bukan 5 s), tautan Setup Guide; `download/route.test.ts`: dua GET → SHA-256 sama, tanpa tulis.

**Acceptance Criteria:**
- Given layar exam terbuka 3 menit, when dimuat ulang, then waktu langsung tampil ±3:00 dan terus berdetik tanpa diumumkan pembaca layar.
- Given mode gelap dan terang, when layar dibuka, then kolom tengah cocok `key-exam.html` (tanpa hint/Dropzone), dan Orbit diam saat Reduce motion aktif.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

- Tanpa DOM harness (epic 4, triage 2.1 #15): logika di helper murni, markup awal lewat render server seperti 2.1; loop detik, poll, dan pause dicek manual.
- Waktu di luar live region: `aria-live="off"` bersarang tidak konsisten antar pembaca layar.
- Endpoint tetap: ambang lambat dari `receivedAt` saat render, atau dari saat klien melihat `received` (selisih ≤ 2 s).
- Tombol pause `absolute`: muncul setelah hidrasi tanpa menggeser tata letak.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: bersih.

**Manual checks (if no CLI):**
- Preview: waktu berdetik dan berlanjut setelah muat ulang; dua "Download again" → `sha256sum` sama; Finish → grading lalu pesan lambat setelah 15 s; pause/play; Reduce motion diam; NVDA tidak membacakan detik.
