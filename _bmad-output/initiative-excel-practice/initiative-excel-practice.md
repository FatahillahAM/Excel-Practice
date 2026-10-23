---
type: initiative
title: "WORKING HARD with EXCEL — latihan Excel sampai lulus Ujian Akhir"
parent: none
covers: [CAP-1, CAP-2, CAP-3, CAP-4, CAP-5, CAP-6, CAP-7, CAP-8, CAP-9, CAP-10, CAP-11, CAP-12, CAP-13, CAP-14, CAP-15, CAP-16, CAP-17, CAP-18, CAP-19, CAP-20, CAP-21]
after: []
assignee: ""
risk: high
---

# WORKING HARD with EXCEL — latihan Excel sampai lulus Ujian Akhir

## Description

Web app latihan Excel pribadi: level bertahap, soal dikerjakan di Excel desktop asli, penilaian otomatis, dan alasan untuk kembali setiap hari (streak, rekor, level terbuka). Spec `spec-excel-practice` memegang capability, constraint, dan non-goal; initiative ini mengantarkan V1 (Level 1–4 + mesin Exam) lalu fase Next (Level 5–9, Ujian Akhir, jalur co-authoring).

## Outcome

El Zavier berlatih Excel tiap hari di aplikasinya sendiri sampai lolos Ujian Akhir; sinyalnya adalah success signal spec (V1 dan Akhir).

## Requirements

Sumber requirement: `SPEC.md` › Capabilities, CAP-1 sampai CAP-21. Tidak disalin ke sini.

## Done when

1. Semua latihan dan Test Level 1–4 bisa diselesaikan lewat Start → `.xlsm` di Excel 2021 → Finish → skor + alasan per soal di web, di laptop pribadi, di Production.
2. File yang sama yang diupload di PC kantor mendapat skor dan alasan identik.
3. Level, streak, freeze, rekor, dan percobaan terbuka terlihat sama di laptop, PC kantor, dan HP.
4. *(Next)* Ujian Akhir lolos 5 kali berturut-turut — masing-masing ≤60 menit, tanpa hint, skor ≥90, data dan skenario berbeda total.

## Boundaries

Seluruh produk dalam spec; epic dipotong per capability. Bukan: multi-user, notifikasi, materi di luar Excel — lihat Non-goals di spec. Tracer lintas epic: satu latihan Level 1 dari Start sampai skor di Production (epic 1 → 2 → 3).

- Touch point: Supabase (Postgres, Auth, Storage, project `prod` + `dev`) — dikonfigurasi lewat migrasi dan dashboard; owner: epic-fondasi-platform
- Touch point: Vercel (Production + Preview) — konfigurasi project dan env var; owner: epic-fondasi-platform
- Touch point: Google Cloud OAuth client — dibuat sekali oleh user; owner: epic-fondasi-platform
- Touch point: Excel 2021 desktop dan template `exam.v<N>.xlsm` — v1 dibuat di spike S1; owner: epic-fondasi-platform, lalu epic-percobaan-kiriman-file

## References

- spec — _bmad-output/specs/spec-excel-practice/SPEC.md, section Capabilities
- constraint — _bmad-output/specs/spec-excel-practice/SPEC.md, sections Constraints dan Non-goals
- architecture — _bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md
- design — _bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/DESIGN.md
- design — _bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md
- design — _bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/mockups/

## Notes

- Decision: store tiket = file di repo ini (`_bmad-output/`), folder initiative `initiative-excel-practice` (user, 2026-10-23).
- Decision: epic pembuka menggabungkan fondasi platform dan spike S1–S3, dan sampai ke Production (user, 2026-10-23).
- Decision: isi tiket berbahasa Indonesia; istilah teknis dan nama Excel tetap Inggris (user, 2026-10-23).
- Decision: susunan 8 epic disetujui; epic 4 (Progres) dan 5 (Konten) boleh paralel setelah epic 3 (user, 2026-10-23).
- Decision: kontrak `LevelModule` (tipe + satu level tracer) dibuat di epic 2, pemakai paling awal; pemeriksa rumus di epic 3; konten penuh di epic 5 (2026-10-23).
- Open question: persetujuan penilaian Pivot berlapis (`pivot-grading.md`), menunggu spike sebelum Level 7; epic-level-5-9 menunggu.
- Waits on: urutan dan kebutuhan antar-epic ada di `tickets.toml` di folder ini.
