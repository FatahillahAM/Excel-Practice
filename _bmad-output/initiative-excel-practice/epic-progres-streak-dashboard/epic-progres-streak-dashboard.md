---
type: epic
title: "Progres, streak, dan Dashboard"
parent: initiative-excel-practice
covers: [CAP-1, CAP-9, CAP-10, CAP-11, CAP-12, CAP-19]
after: []
assignee: ""
risk: medium
---

# Progres, streak, dan Dashboard

## Description

Level terbuka bertahap, Test menggerbang level, streak dan freeze mengikuti aturan spec, rekor waktu tercatat, Practice again tersedia, dan semuanya terlihat sama di laptop, PC kantor, dan HP lewat Dashboard dan Level Map.

## Outcome

El Zavier punya alasan kembali setiap hari dan selalu tahu posisinya; sinyalnya CAP-1, CAP-10, dan CAP-12 di spec.

## Requirements

Diisi saat inception: baris dari spec (dan spine bila perlu) sebagai id stabil, dipetakan ke covers.

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

- Waits on epic-penilaian-hasil-tips because: progres dihitung dari percobaan berstatus graded dengan Result tersimpan.
- Decision: boleh berjalan paralel dengan epic-konten-level-1-4 (user, 2026-10-23).
- Parked (dari epic 1, refactor sweep 1.10, 2026-10-30): repo belum punya harness render komponen (Vitest hanya node); tambahkan bersama Dashboard, permukaan konten pertama, lalu tutup cabang Settings "Not set" dan gagal-muat-pertama yang kini hanya dicek manual.
