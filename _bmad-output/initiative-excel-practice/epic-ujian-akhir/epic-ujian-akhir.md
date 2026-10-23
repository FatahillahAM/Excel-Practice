---
type: epic
title: "Ujian Akhir (Next)"
parent: initiative-excel-practice
covers: [CAP-14]
after: []
assignee: ""
risk: high
---

# Ujian Akhir (Next)

## Description

Ujian Akhir: beberapa file data mentah menjadi laporan multi-sheet + Summary + Pivot dari file lain, dengan batas 60 menit, tanpa hint, dan penghitung 5 lolos berturut-turut.

## Outcome

El Zavier membuktikan kelulusan; sinyalnya success signal Akhir di spec.

## Requirements

Diisi saat inception: baris dari spec (dan spine bila perlu) sebagai id stabil, dipetakan ke covers.

## Done when

1. Tiap percobaan memakai skenario runtime dan data yang berbeda total dari percobaan sebelumnya.
2. Sisa waktu tampil di layar percobaan; pada menit ke-60 file otomatis dikirim dan dinilai apa adanya; upload sesudahnya ditolak.
3. Lolos = ≤60 menit, 0 hint, skor ≥90; penghitung naik hanya bila berturut-turut dan reset ke nol saat gagal; status Lulus muncul pada hitungan ke-5.
4. Semua di atas berjalan di Production.

## Boundaries

Ujian Akhir saja. Bukan: Level 5–9 (epic 6).

## References

- parent — _bmad-output/initiative-excel-practice/initiative-excel-practice.md
- spec — _bmad-output/specs/spec-excel-practice/SPEC.md, CAP-14
- bridge — _bmad-output/specs/spec-excel-practice/exam-bridge.md, section Batas waktu Ujian Akhir
- architecture — _bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md, sections AD-5 (state closed) dan Deferred

## Notes

- Waits on epic-level-5-9 because: butuh Level 9 dan penilaian Pivot.
