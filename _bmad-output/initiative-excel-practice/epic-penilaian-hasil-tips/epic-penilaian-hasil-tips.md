---
type: epic
title: "Penilaian, hasil, dan Tips"
parent: initiative-excel-practice
covers: [CAP-5, CAP-7, CAP-8, CAP-21]
after: []
assignee: ""
risk: high
---

# Penilaian, hasil, dan Tips

## Description

File yang diterima dinilai di server dari hasil dan metode, hint bisa dibuka untuk soal yang dipilih, Results muncul sendiri dengan soal salah beserta alasan dan Tips untuk semua soal, dan hasil lama bisa dibuka lagi dari History dan Tips & Tricks.

## Outcome

Setiap percobaan memberi skor, alasan, dan Tips yang sama apa pun jalurnya; sinyalnya CAP-5 di spec dan J1 di EXPERIENCE.md.

## Requirements

Diisi saat inception: baris dari spec (dan spine bila perlu) sebagai id stabil, dipetakan ke covers.

## Done when

1. File yang sama lewat macro dan upload mendapat skor dan alasan identik (tes paritas di CI dan cek manual di Production).
2. Angka yang diketik dan fungsi yang salah dinilai salah dengan alasan tertulis; skor = poin soal benar − 5 per hint, minimal 0.
3. Hint dibuka untuk soal yang dipilih, jatah berkurang, dan potongan −5 tercatat untuk percobaan itu.
4. Results tampil sendiri setelah dinilai: soal salah + alasan, deretan Tips untuk semua soal, suasana tenang di bawah 80, efek api hanya untuk Test lulus.
5. Tips & Tricks memuat semua kartu yang pernah tampil dengan filter level dan pencarian; History membuka lagi hasil lama.
6. Semua di atas berjalan di Production.

## Boundaries

Penilaian, hint, Results, Tips & Tricks, History. Bukan: progres, streak, gerbang level (epic 4), konten penuh Level 1–4 (epic 5).

## References

- parent — _bmad-output/initiative-excel-practice/initiative-excel-practice.md
- spec — _bmad-output/specs/spec-excel-practice/SPEC.md, CAP-5, CAP-7, CAP-8, CAP-21
- architecture — _bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md, sections AD-3, AD-5, AD-7, AD-10, AD-11, AD-12
- design — _bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md, sections Results, Score Badge, Tips Carousel, Hint Button, Hint Select
- design — _bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/mockups/key-results.html

## Notes

- Waits on epic-percobaan-kiriman-file because: butuh kontrak LevelModule, snapshot percobaan, dan file berstatus received.
