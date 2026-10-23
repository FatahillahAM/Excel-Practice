---
type: epic
title: "Level 5–9 (Next)"
parent: initiative-excel-practice
covers: [CAP-13]
after: []
assignee: ""
risk: high
---

# Level 5–9 (Next)

## Description

Level 5–9 (Rapikan data, Rumus modern, Pivot, Lintas file, Summary) dimainkan dengan alur Exam yang sama, skenarionya dibuat AI saat runtime, dan label Under Construction hilang.

## Outcome

Kurikulum lengkap menuju Ujian Akhir; sinyalnya CAP-13 di spec.

## Requirements

Diisi saat inception: baris dari spec (dan spine bila perlu) sebagai id stabil, dipetakan ke covers.

## Done when

1. Kelima level bisa dimainkan dari Start sampai Results tanpa perubahan pada mesin Exam, penilaian, streak, atau UI peta level.
2. Skenario AI lolos validasi skema generator sebelum percobaan dimulai; kunci Claude API hanya di server.
3. PivotTable dinilai menurut `pivot-grading.md` setelah spike Pivot disetujui; file sumber Level 8 bekerja di folder kerja lokal di laptop dan PC kantor.
4. Semua di atas berjalan di Production.

## Boundaries

Konten Level 5–9 dan adapter AI. Bukan: Ujian Akhir (epic 7).

## References

- parent — _bmad-output/initiative-excel-practice/initiative-excel-practice.md
- spec — _bmad-output/specs/spec-excel-practice/SPEC.md, CAP-13
- curriculum — _bmad-output/specs/spec-excel-practice/level-curriculum.md
- content — _bmad-output/specs/spec-excel-practice/content-generation.md
- pivot — _bmad-output/specs/spec-excel-practice/pivot-grading.md
- architecture — _bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md, sections AD-2, AD-10 dan Deferred

## Notes

- Waits on epic-konten-level-1-4 because: memakai pola modul level yang sudah terbukti.
- Open question: persetujuan penilaian Pivot berlapis, menunggu spike dengan file Office 2021 sebelum Level 7.
