---
type: epic
title: "Percobaan dan kiriman file"
parent: initiative-excel-practice
covers: [CAP-2, CAP-3, CAP-4, CAP-16, CAP-18, CAP-20]
after: []
assignee: ""
risk: high
status: in-progress
---

# Percobaan dan kiriman file

## Description

Start membuat percobaan dan file `.xlsm` baru, Finish atau upload mengantarkan file kembali, server menolak file yang bukan milik percobaan dengan alasan yang jelas, dan satu percobaan terbuka bisa dilanjutkan atau dibatalkan dari perangkat mana pun.

## Outcome

El Zavier mengerjakan soal di Excel dan file-nya selalu sampai ke server yang benar, lewat macro di laptop atau upload di PC kantor; sinyalnya CAP-2/3/4 di spec.

## Requirements

- CAP-2: Start mengunduh `.xlsm` berisi sheet Instructions (skenario + perintah), data, dan tombol Finish yang terbuka di Excel 2021; waktu mulai tercatat di server. (SPEC, CAP-2)
- CAP-3: Finish menyimpan dan mengirim file, menampilkan pesan terkirim, menutup workbook (dan Excel bila tak ada workbook lain), lalu web berpindah sendiri; bila gagal, workbook tetap terbuka dengan pesan ke upload. (SPEC, CAP-3)
- CAP-4: Upload lewat web saat macro diblokir; file yang sama lewat macro dan upload diperlakukan sama. (SPEC, CAP-4)
- CAP-16: Setup Guide: folder kerja tetap = lokasi simpan + Trusted Location, Unblock, arahan ke upload; setelah diikuti di laptop Finish berjalan. (SPEC, CAP-16)
- CAP-18: Kiriman ditolak dengan pesan berbeda per alasan (bukan percobaan ini, sudah dinilai, identitas diubah/rusak, sudah ditutup), lewat macro dan upload; percobaan tetap terbuka kecuali alasannya sudah ditutup. (SPEC, CAP-18)
- CAP-20: Satu percobaan terbuka; Start lain terkunci; Resume membuka lagi layar percobaan dengan waktu sejak Start; Abandon membatalkan tanpa dinilai; unduh ulang memberi file yang sama tanpa mengubah waktu mulai. (SPEC, CAP-20; ulang penilaian gagal = epic 3)
- B1: Siklus `attempts.status` satu mesin dan satu penulis (AD-5), termasuk transisi baru received/grading_failed → abandoned. (spine AD-5)
- B2: `submit(bytes, channel)` dipakai macro dan upload dengan urutan keputusan AD-6 dan 5 kode; modul VBA yang tidak dipin harus kosong. (spine AD-4, AD-6)
- B3: `GET /api/attempts/:attemptId/status` dan polling layar exam tiap 2 s; pesan lambat setelah 15 s di received. (spine AD-11)
- B4: Kontrak `LevelModule` di `src/core/content` dan konten Level 1 Practice 1, divalidasi zod. (spine AD-2, Conventions › Validation)
- B5: File hasil Start disimpan sekali per percobaan di `attempt-files`; unduh ulang melayani byte itu. (spine AD-4, Conventions › Storage paths)
- B6: Batas ukuran body dan hasil inflate di jalur macro dan upload. (spine Deferred; Parked epic 1)
- B7: Template v1 ditandai rilis sebelum percobaan asli pertama di Production. (spine AD-4; Parked epic 1)

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
- Decision: tracer bullet = entry 1 (Start L1 P1 → unduh → Finish → layar "File received — grading…" di Production); setelahnya jalur paralel core/submit (2→3), layar exam (4→5), Level Detail Panel (6→7), konten (8); modFinish (9) setelah kode final; Setup Guide (10); refactor sweep (11); uji Production + rilis v1 (12) (user, 2026-11-02).
- Decision: AD-5 menambah transisi received/grading_failed → abandoned agar Abandon membuka kunci sebelum ada penilaian (menjawab pertanyaan terbuka AD-5) (user, 2026-11-02).
- Decision: Start di epic ini ada di Level Detail Panel Level 1 pada /levels; epic 4 menambah Level Map di sekitarnya (user, 2026-11-02).
- Decision: template v1 diubah di tempat untuk modFinish epic ini, lalu ditandai rilis di entry 12; perubahan sesudahnya = v2 (user, 2026-11-02).
- Decision: modul VBA yang tidak dipin harus ternormalisasi kosong; kode tambahan di modul mana pun = IDENTITY_ALTERED (spine AD-4) (user, 2026-11-02).
- Touch point: "Try again" penilaian gagal dan hint yang terbuka saat Resume milik epic 3 (CAP-7, CAP-20); pesan HP saat Start milik epic 4 (CAP-12). Kasus ALREADY_GRADED diuji di entry 12 dengan status yang diset lewat SQL.
- Decision: tracer 2.1 lulus di Production: Start L1 P1 → unduh → Finish di Excel 2021 laptop → layar exam berpindah ke "File received — grading…". Tabel `attempts`, bucket `attempt-files`, dan kontrak `LevelModule` minimal ada; `bridge_proofs` dihapus (entry 1, user, 2026-11-03).
- Decision: 2.2 memusatkan transisi AD-5 di `src/core/services/attempts` (compare-and-set di adapter), menambah migrasi `20261103000001_attempts_abandon` (pemilik hanya bisa ke `abandoned` dari open/received/grading_failed), dan tes kontrak DB di Postgres 16 (job CI `db-contract`) (entry 2, user, 2026-11-03).
- Decision: 2.3 memindahkan AD-6 ke `submit(bytes, channel, ports)` di `src/core/submission` dengan lima kode; `.xlsm` dicek lewat content type, modul tak dipin hanya boleh kosong atau berisi baris `Option`, `submission-1.xlsm` ditimpa selama percobaan `open`, body ≤ 4 MiB (413 `FILE_TOO_LARGE`, di luar RejectionCode), inflate ≤ 32 MiB dan ≤ 1000 entri (entry 3, user, 2026-11-03).
- Decision: 2.4 menambah layar exam lengkap: waktu sejak Start dari server (`elapsedSeconds`, dijangkar ulang tiap polling, di luar live region), Orbit Loader SVG+CSS dengan pause/play dan diam saat reduced motion, pesan penilaian lambat setelah 15 s di `received`, tautan Setup Guide, dan slot Dropzone untuk entry 5 (entry 4, user, 2026-11-03).
- Decision: 2.5 menambah `POST /api/submissions/upload` (sesi dicek dulu, lalu service role hanya untuk percobaan milik user sesi; AD-9 diubah, tanpa migrasi), wajib `application/octet-stream` (415), dan Upload Dropzone di layar exam saat `open` dengan pesan penolakan per kode; route macro dan upload berbagi `http.ts` dan `service-ports.ts` (entry 5, user, 2026-11-03).
- Decision: 2.6 merender Level Detail Panel Level 1 inline di /levels (Practice 1–5 + Test, status dari konten, satu Start di foot, `startLock` untuk entry 7); Sheet dari Level Node menunggu epic 4 (entry 6, user, 2026-11-06).
- Decision: 2.7 menambah Attempt Card di Dashboard (Resume ke `/exam/<id>`, Abandon lewat AlertDialog → Server Action → `abandon()` AD-5, satu retry saat `lost`) dan mengunci Start di /levels dengan `BLOCKED_MESSAGE` selama ada percobaan terbuka; tanpa migrasi (entry 7, user, 2026-11-06).
- Decision: 2.8 mengisi L01-P1: `generate(seed, scenario)` murni (mulberry32), 12 skenario batch produksi, 4 soal referensi `$` (20/25/25/30), `MAX_QUESTIONS` 4 (B10 untuk Finish), validasi zod saat load; snapshot AD-3 di `attempts.snapshot` ditulis sekali oleh service role setelah insert sesi, sesi tanpa hak atas kolom itu (migrasi `20261104000001`, AD-9 diubah) (entry 8, user, 2026-11-06).
- Decision: 2.9 memetakan setiap jawaban server di `modFinish.bas` ke satu message box Indonesia (`macroMessages`), menyimpan workbook sebelum mengirim, dan menutup workbook (Excel ikut keluar bila aman) setelah diterima; template v1 dibangun ulang di Excel laptop dan sidik jari v1 dihitung ulang (`0067736c…`); uji laptop di Preview lulus untuk diterima, ATTEMPT_CLOSED, IDENTITY_ALTERED, NOT_THIS_ATTEMPT, offline, ALREADY_GRADED, read-only, dan > 4 MiB. Preview butuh Vercel Authentication mati selama uji macro (entry 9, user, 2026-11-09).
- Decision: 2.10 mengisi Setup Guide dengan 5 langkah (folder `C:\ExcelPractice`, unduhan browser ke sana, Trusted Location, buka dari folder, Unblock sebagai cadangan) dan tautan Resume; uji laptop membuktikan file unduhan di Trusted Location menjalankan Finish tanpa Unblock (entry 10, user, 2026-11-09).
- Decision: 2.11 refactor sweep tanpa perilaku baru: `node scripts/spike-s1.ts` jalan tanpa flag (`erasableSyntaxOnly`), Vitest mengenal alias `@/` dan impor lintas area di luar `src/core` memakai `@/`, tes route macro memakai fixture bersama, `PlaceholderPage` tanpa prop `enter`, `UploadMessage` dihapus, tes pin jszip 3.10.2 + `internalStream`, catatan Vercel Authentication di Preview di README template, dan baris Message set untuk pesan macro/ukuran. 18 entri tertunda didisposisi di `deferred-work.md`: 10 ditutup, 8 dipindah (epic 3: 2, epic 4: 5, story 2.12: 1 — titik rilis template v1, B7) (entry 11, 2026-11-09).
- Decision: 2.12 lulus DW1–6 di Production (deployment `dpl_4qx37LDs…`, `main` 273da77), 2026-11-09 02:01–02:31Z: macro dan upload untuk ALREADY_GRADED (eb824d75 02:01:12Z; bcb40c19 02:30:35Z), percobaan C bd3bdc8c (unduh ulang SHA-256 sama `F1AA2C94…`, IDENTITY_ALTERED macro 02:13:48Z, received macro 02:14:08Z, ATTEMPT_CLOSED macro 02:14:59Z / upload 02:27:20Z), B bcb40c19 di PC kantor (IDENTITY_ALTERED `.xlsx` 02:23:51Z, received upload 02:24:10Z), NOT_THIS_ATTEMPT macro 02:23:07Z / upload 02:27:04Z, Abandon/Resume lintas perangkat (a78e00b8, bd3bdc8c, bcb40c19, 3ae91bb7); tidak ada percobaan terbuka di `prod`. Template v1 dirilis 2026-11-09 (file SHA-256 `aa2b82e2…`, `modFinish` `0067736c…`); perubahan berikutnya = `exam.v2.xlsm` (entry 12, 2026-11-09).
