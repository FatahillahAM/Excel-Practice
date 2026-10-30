---
type: epic
title: "Percobaan dan kiriman file"
parent: initiative-excel-practice
covers: [CAP-2, CAP-3, CAP-4, CAP-16, CAP-18, CAP-20]
after: []
assignee: ""
risk: high
---

# Percobaan dan kiriman file

## Description

Start membuat percobaan dan file `.xlsm` baru, Finish atau upload mengantarkan file kembali, server menolak file yang bukan milik percobaan dengan alasan yang jelas, dan satu percobaan terbuka bisa dilanjutkan atau dibatalkan dari perangkat mana pun.

## Outcome

El Zavier mengerjakan soal di Excel dan file-nya selalu sampai ke server yang benar, lewat macro di laptop atau upload di PC kantor; sinyalnya CAP-2/3/4 di spec.

## Requirements

Diisi saat inception: baris dari spec (dan spine bila perlu) sebagai id stabil, dipetakan ke covers.

## Done when

1. Start di laptop mengunduh `.xlsm` berisi data baru dan sheet Instructions; unduh ulang memberi file yang sama dan waktu mulai tidak berubah.
2. Finish mengirim file dan layar exam berpindah ke "File received — grading…" tanpa langkah lain; di PC dengan macro diblokir, upload file yang sama diterima dengan cara yang sama.
3. File lama, salinan Save As `.xlsx`, file percobaan yang sudah dinilai, dan file percobaan yang dibatalkan ditolak dengan pesan masing-masing, lewat macro maupun upload.
4. Hanya ada satu percobaan terbuka; Resume dan Abandon di Attempt Card bekerja dari laptop dan PC kantor.
5. Setup Guide menuntun folder kerja tetap dan Trusted Location, dan Finish berjalan setelah diikuti di laptop.
6. Semua di atas berjalan di Production.

## Boundaries

Siklus percobaan dan jalur kiriman file. Bukan: penilaian dan Results (epic 3), progres dan Dashboard penuh (epic 4), konten selain level tracer (epic 5).

## References

- parent — _bmad-output/initiative-excel-practice/initiative-excel-practice.md
- spec — _bmad-output/specs/spec-excel-practice/SPEC.md, CAP-2, CAP-3, CAP-4, CAP-16, CAP-18, CAP-20
- architecture — _bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md, sections AD-2, AD-4, AD-5, AD-6, AD-11, AD-13
- bridge — _bmad-output/specs/spec-excel-practice/exam-bridge.md
- design — _bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md, sections Exam in progress, Attempt Card, Upload Dropzone, Exam Workbook, Setup Steps
- design — _bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/mockups/key-exam.html

## Notes

- Waits on epic-fondasi-platform because: butuh adapter WorkbookIO dan template exam.v1.xlsm yang terbukti di spike S1–S3, serta login dan environment.
- Decision: epic ini membuat tipe `LevelModule` dan satu level tracer kecil (Level 1, Practice 1) karena Start adalah pemakai paling awal (2026-10-23).
- Parked: halaman `/dev/bridge-proof` dari epic 1 dihapus di story pertama epic ini setelah Start asli tersedia.
- Parked (dari epic 1, refactor sweep 1.10, 2026-10-30), dikerjakan saat `submit()` dan `attempts` dibangun:
  - Modul VBA yang tidak dipin diabaikan sidik jari AD-4, padahal exam-bridge.md menganggap macro yang diubah = identitas berubah; putuskan di spine bersama `submit()`.
  - Batasi ukuran unggahan dan ukuran hasil inflate sebelum/dalam `readWorkbook`; route macro publik (zip bomb).
  - modFinish: pesan per kode AD-6 dalam bahasa Indonesia, petunjuk non-jaringan untuk 413/TLS/TEMP, perbaiki komentar `TempCopyPath`; butuh rebuild template + uji laptop.
  - Tandai titik rilis template v1 sebelum percobaan asli pertama; perubahan modFinish sesudahnya menjadi v2.
  - Tes kontrak DB (grant, RLS, nama parameter RPC) terhadap migrasi asli, dibangun bersama `attempts`.
  - Hapus juga tabel `bridge_proofs` dan RPC `record_bridge_proof_receipt` bersama halaman `/dev/bridge-proof`.
  - Profil bisa belum ada bila zona waktu browser tidak valid saat login (`ensureProfile` → `skipped`); buat atau wajibkan profil sebelum `attempts` merujuk `profiles`.
