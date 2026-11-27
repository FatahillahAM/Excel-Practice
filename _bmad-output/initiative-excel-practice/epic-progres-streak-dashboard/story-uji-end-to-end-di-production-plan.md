---
title: 'Uji end-to-end di Production'
type: 'chore'
ticket: '7'
created: '2026-11-27'
status: 'in-progress'
route: 'oneshot'
route_source: 'user'
review: 'none'
review_source: 'auto'
lenses_ran: []
review_loop_iteration: 0
---

## Intent

Prove epic 4 "Done when" 1–6 in Production with log/SQL evidence now that Level 1 has P1..P5 + Test (epic 5: 5.1, 5.2, 5.7). No code change; hitl run by the user, evidence by the agent (Vercel runtime logs, prod SQL `njkftlwsfpggrciyrwim`).

## Checklist (user runs, agent collects evidence)

| # | Done when | Langkah user di Production | Bukti agent |
|---|---|---|---|
| A | 1 Dashboard + Level Map | Buka Dashboard dan /levels (desktop + HP); cek Level Path, Streak Hero, rail, intro 3D; Settings → Reduce motion → frame statis | log tanpa error |
| B | 2 Gerbang Test | Selesaikan P1..P5 L1 (boleh skor berapa saja) → Test L01 terbuka | SQL: 5 practice graded + Test dapat di-start |
| C | 2 Test gagal diulang | Kerjakan Test L01 dengan skor < 80 → "Practice again"/ulang Test langsung tersedia | SQL: attempt Test graded < 80, attempt baru boleh dibuat |
| D | 2 Lulus Test | Test L01 skor ≥ 80 → Level 2 terbuka (Level 2 tampil "The Test for this level isn't ready yet." / belum ada konten) dan sidebar "1 of 9 levels passed" | SQL: Test ≥ 80; UI |
| E | 2 Akhir V1 | Tidak bisa diuji di Production sampai L04-T ada (5.5); dibuktikan tes fixture `level-progress` (lihat Notes) | tes CI |
| F | 3 Streak + freeze | Dashboard: hari ini belum aman + sisa waktu; besoknya pakai Use freeze bila belum mengerjakan | SQL `freezes`, `streak_days()` |
| G | 4 Rekor + Practice again | Ulang satu Practice lebih cepat → "New record"; pips/gerbang/status level tidak berubah | SQL durasi; UI |
| H | 5 HP | Di HP: angka streak muncul cepat (≤0,5 s), Use freeze jalan, Start menampilkan pesan HP tanpa membuat attempt | SQL: tidak ada attempt baru dari HP |
| I | 6 Production | Semua di atas | — |

## Notes

- Done when 2 "akhir V1" (Level 4) tetap dibuktikan lewat tes fixture sampai 5.5 (Decision epic 4, 2026-11-19); dicentang ulang di Production setelah 5.5.
- Vercel Hobby menyimpan log 1 jam: user melapor per kelompok langkah (A–C, D–E, F–H).

## Production Evidence

## Review Triage Log
