---
type: epic
title: "Konten Level 1–4"
parent: initiative-excel-practice
covers: [CAP-6]
after: []
assignee: ""
risk: medium
---

# Konten Level 1–4

## Description

Level 1–4 (Fondasi, Logika, Hitung bersyarat, Cari data) masing-masing punya 5 latihan dan 1 Test dengan bank skenario manufaktur, data acak tiap percobaan, kunci yang dihitung program, hint, dan Tips.

## Outcome

El Zavier bisa berlatih seluruh V1 dengan soal yang selalu baru; sinyalnya CAP-6 di spec dan Done when 1 initiative.

## Requirements

Diisi saat inception: baris dari spec (dan spine bila perlu) sebagai id stabil, dipetakan ke covers.

## Done when

1. Level 1–4 masing-masing punya 5 latihan + 1 Test dan minimal 10 skenario; dua percobaan berturut-turut memakai data berbeda dan kunci sama dengan hasil hitung ulang.
2. Setiap modul lulus validasi di CI: total poin 100 per percobaan, tanpa fungsi khusus Microsoft 365, fixture correct dan typed-values dinilai sesuai harapan.
3. Perintah soal, hint, dan Tips berbahasa Indonesia santai dengan nama Excel versi Inggris, dan hanya memakai domain manufaktur user.
4. Setiap item Level 1–4 bisa dimainkan dari Start sampai Results di Production.

## Boundaries

Konten Level 1–4 sebagai modul plug-in. Bukan: mesin, penilaian, atau UI (epic 2–4); Level 5–9 (epic 6).

## References

- parent — _bmad-output/initiative-excel-practice/initiative-excel-practice.md
- spec — _bmad-output/specs/spec-excel-practice/SPEC.md, CAP-6 dan Constraints
- curriculum — _bmad-output/specs/spec-excel-practice/level-curriculum.md
- content — _bmad-output/specs/spec-excel-practice/content-generation.md
- architecture — _bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md, sections AD-2, AD-3, AD-10; Consistency Conventions › Validation dan Testing

## Notes

- Waits on epic-penilaian-hasil-tips because: butuh pemeriksa rumus di core dan penilaian dengan poin per soal.
- Decision: boleh berjalan paralel dengan epic-progres-streak-dashboard (user, 2026-10-23).
