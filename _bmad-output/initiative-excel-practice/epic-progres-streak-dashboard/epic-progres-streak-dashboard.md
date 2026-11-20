---
type: epic
title: "Progres, streak, dan Dashboard"
parent: initiative-excel-practice
covers: [CAP-1, CAP-9, CAP-10, CAP-11, CAP-12, CAP-19]
after: ["3.1"]
assignee: ""
risk: medium
---

# Progres, streak, dan Dashboard

## Description

Level terbuka bertahap, Test menggerbang level, streak dan freeze mengikuti aturan spec, rekor waktu tercatat, Practice again tersedia, dan semuanya terlihat sama di laptop, PC kantor, dan HP lewat Dashboard dan Level Map.

## Outcome

El Zavier punya alasan kembali setiap hari dan selalu tahu posisinya; sinyalnya CAP-1, CAP-10, dan CAP-12 di spec.

## Requirements

Dari SPEC.md (id dipakai apa adanya): CAP-1, CAP-9, CAP-10, CAP-11, CAP-12, CAP-19. Dari spine dan Notes:

- D1 (AD-7): progres diturunkan oleh fungsi murni dari attempt `graded`, tanpa counter tersimpan. → CAP-1, CAP-12
- D2 (AD-8): hari = tanggal lokal `received_at` di `profiles.time_zone`; baris freeze; maks 2 per minggu ISO. → CAP-10
- D3 (AD-12): gerak CSS saja dengan frame statis (reduced motion, Firefox). → CAP-12
- D4: Start dan Practice again di HP menampilkan pesan HP dan tidak memanggil apa pun. → CAP-19
- P1: hapus izin mati `closed`+result di `attempts_result_only_when_graded` (dari 3.10). → —
- P2: polesan panel ≥80 di samping "New record" (dari 3.10). → CAP-11
- P3: tes DOM yang tertunda dari epic 1–2 (harness sudah ada sejak 3.3). → —
- P4: "Start Test" di Level Detail Panel, keadaan lulus Test, eyebrow asli (dari 2.6). → CAP-9

## Done when

1. Dashboard dan Level Map sesuai mockup: Level Path, Streak Hero, rail, dan adegan 3D Level Map dengan frame statis untuk reduced motion dan Firefox.
2. Lulus Test Level N (≥80) membuka Level N+1; Test terbuka setelah 5 latihan; Test gagal bisa langsung diulang; lulus Test Level 4 menampilkan akhir V1.
3. Streak dan freeze mengikuti aturan CAP-10 di zona waktu tetap; Dashboard menunjukkan bila hari ini belum aman beserta sisa waktunya.
4. Rekor waktu per item tercatat dan ditandai "New record"; Practice again tidak mengubah pips, gerbang Test, atau status level.
5. Di HP angka streak tampil dalam ≤0,5 detik, Use freeze bekerja, dan Start menampilkan pesan HP tanpa membuat percobaan.
6. Semua di atas berjalan di Production.

## Boundaries

Progres turunan, streak, rekor, Dashboard, Level Map, Records, tampilan HP. Bukan: penilaian (epic 3), konten level (epic 5).

## References

- parent — _bmad-output/initiative-excel-practice/initiative-excel-practice.md
- spec — _bmad-output/specs/spec-excel-practice/SPEC.md, CAP-1, CAP-9, CAP-10, CAP-11, CAP-12, CAP-19
- architecture — _bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md, sections AD-2, AD-7, AD-8, AD-12; Consistency Conventions › Device gating
- design — _bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md, sections Dashboard, Level Map, Streak Hero, Phone Dock, Responsive & Platform
- design — _bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/mockups/key-dashboard.html
- design — _bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/mockups/key-level-map.html

## Notes

- Decision: 4.3 done — PR #29 di-merge (tanpa migrasi); Practice again, label, Test unavailable dan pembatasan HP sesuai di Production menurut user (user, 2026-11-20).
- Decision: plan 4.4–4.6 — semua rekomendasi disetujui: tanpa kartu Records di rail; Test gagal ikut rekor; urutan kurikulum; /levels diganti peta dengan panel terbuka di level aktif; adegan 3D tiap kunjungan dengan Skip intro; hitungan sidebar bila mudah; risiko yang diterima dicatat; entri butuh konten epic 5 dipindah ke epic 5 (user, 2026-11-20).
- Decision: 4.2 done — PR #28 di-merge, migrasi freezes diterapkan ke prod; Streak Hero di Production sesuai menurut user; log bersih (user, 2026-11-19).
- Decision: 4.1 done — PR #27 di-merge (tanpa migrasi); di Production Level Path di HP dan /levels di laptop sesuai menurut user; log bersih (user, 2026-11-19).
- Decision: plan 4.1–4.3 — semua asumsi dan rekomendasi disetujui: hanya `graded` dihitung; pesan streak dimulai ulang ditunda ke 4.6; Use freeze tetap tampil redup saat streak 0; tombol HP disembunyikan lewat CSS; Test yang belum ada tampil "unavailable" sampai epic 5 (user, 2026-11-19).
- Decision: inception epic 4 — 7 tiket (gabungan dari 12 untuk menghemat token): tracer Level Path; streak+freeze+Streak Hero; gerbang Test+Practice again; Records+New record+panel ≥80; Level Map+3D; sapu bersih+tes DOM tertunda; uji Production terakhir (user, 2026-11-19).
- Decision: hari streak = tanggal lokal `received_at` di zona waktu profil (AD-8); streak dihitung dari ≥1 attempt `graded` berapa pun skornya termasuk Practice again; freeze ditolak di hari yang sudah punya attempt graded (user, 2026-11-19).
- Decision: Records per item (latihan dan Test terpisah), durasi `received_at − started_at`; "New record" hanya bila mengalahkan rekor sebelumnya; satu migrasi saja (tabel `freezes` + P1) di tiket 2 (user, 2026-11-19).
- Decision: uji Production epic 4 menunggu konten Test dari epic 5; Done when 2 dibuktikan lewat tes fixture sampai itu ada. Cache progres ditunda (AD-7) (user, 2026-11-19).
- Source conflict: Done when 2 (lulus Test Level 4 → akhir V1) — konten Test belum ada di `src/content/levels` (milik epic 5).

- Waits on epic-penilaian-hasil-tips because: progres dihitung dari percobaan berstatus graded dengan Result tersimpan.
- Decision: boleh berjalan paralel dengan epic-konten-level-1-4 (user, 2026-10-23).
- Parked (dari epic 1, refactor sweep 1.10, 2026-10-30): repo belum punya harness render komponen (Vitest hanya node); tambahkan bersama Dashboard, permukaan konten pertama, lalu tutup cabang Settings "Not set" dan gagal-muat-pertama yang kini hanya dicek manual.
  - Diperluas oleh refactor sweep 2.11 (2026-11-09): harness yang sama juga menutup permukaan epic 2 yang kini hanya dicek manual: loop polling/auto-download ExamStatus serta efek tick/poll/slow-timer (2.1, 2.4), toggle pause/play Orbit Loader dan hilangnya tombol saat reduced motion (2.4), interaksi Upload Dropzone (fokus kembali setelah penolakan, pengumuman alert/status, drag-over, aktivasi keyboard, input nonaktif saat upload) (2.5), dan dialog Abandon (slot error, error basi disembunyikan, tutup saat selesai, kunci pending, focus trap dan kembali) (2.7).
- Parked (dari epic 2, refactor sweep 2.11, 2026-11-09): Level Detail Panel belum punya "Start Test" setelah kelima practice selesai, belum ada status lulus Test, dan eyebrow "Active" masih tetap (2.6); butuh konten Test (epic 5) dan progres dari hasil penilaian (AD-7); Level Map epic ini membungkus panel itu.
- Parked (dari epic 3, refactor sweep 3.10, 2026-11-19):
  - Gaya panel ≥80 dari mockup belum dibangun: tint radial `glow-soft` di panel Outcome, gradien dan cincin inset koin, serta border `glow` saat hover (3.6); visual baru, dikerjakan sebagai polish Results di samping "New record" (keputusan user 3.10).
  - Cek `attempts_result_only_when_graded` di migrasi `20261109000001` masih menerima `closed` dengan result, padahal pagar status `20261110000001` sudah menolak `graded → closed`; sisa izin ini tidak dipakai jalur mana pun (header `20261110000001` mencatatnya; 3.3 triage #11); hapus di migrasi `attempts` pertama epic ini.
