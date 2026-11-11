---
type: epic
title: "Penilaian, hasil, dan Tips"
parent: initiative-excel-practice
covers: [CAP-5, CAP-7, CAP-8, CAP-21]
after: []
assignee: ""
risk: high
status: in-progress
---

# Penilaian, hasil, dan Tips

## Description

File yang diterima dinilai di server dari hasil dan metode, hint bisa dibuka untuk soal yang dipilih, Results muncul sendiri dengan soal salah beserta alasan dan Tips untuk semua soal, dan hasil lama bisa dibuka lagi dari History dan Tips & Tricks.

## Outcome

Setiap percobaan memberi skor, alasan, dan Tips yang sama apa pun jalurnya; sinyalnya CAP-5 di spec dan J1 di EXPERIENCE.md.

## Requirements

- CAP-5: Rumus dengan fungsi yang diminta dan hasil benar dinilai benar; angka benar yang diketik manual atau fungsi yang salah dinilai salah dengan alasan tertulis; poin per soal, total 100; skor = poin soal benar − 5 per hint, minimal 0; hasil menampilkan "x of y correct" dan alasan tiap soal salah. (SPEC, CAP-5)
- CAP-7: Hint dibuka dari halaman percobaan aktif untuk soal yang dipilih dan tercatat di server untuk percobaan itu, jalur macro maupun upload; tiap hint −5 poin dan memakai satu jatah (3 di Level 1–4). (SPEC, CAP-7)
- CAP-8: Tiap soal yang dinilai, benar maupun salah, menampilkan satu kartu Tips yang relevan, dengan minimal satu shortcut bila ada; tiap kartu yang pernah tampil masuk koleksi Tips & Tricks yang bisa difilter per level dan dicari. (SPEC, CAP-8)
- CAP-21: History menampilkan percobaan yang sudah dinilai; membuka satu percobaan menampilkan lagi skor, waktu, soal salah beserta alasannya, dan kartu Tips-nya. (SPEC, CAP-21)
- B1: Penilaian berjalan di `after()` dari request submit macro dan upload, menulis graded/grading_failed dengan compare-and-set pada `received`, dan endpoint status mengembalikan `resultId`. (spine AD-3, AD-5, AD-11)
- B2: Trigger database memagari setiap tulisan `attempts.status` (termasuk service role) terhadap diagram AD-5; compare-and-set grader yang kembali `lost` setelah Abandon dicatat di log dan hasilnya dibuang. (spine AD-5; Parked epic 2)
- B3: "Try again" untuk percobaan `grading_failed` (grading_failed → received → dinilai ulang). (CAP-20 sisa dari epic 2; spine AD-5)
- B4: Kontrak `LevelModule` menambah hint berurutan dan satu Tip per soal (divalidasi zod, tanpa fungsi khusus Microsoft 365); snapshot percobaan menyimpan hint, Tip, dan `hintQuota`. (spine AD-2, AD-3, AD-10)
- B5: Tabel `hint_reveals` unik per (percobaan, soal, indeks hint), diisi hanya saat `open` dalam satu transaksi yang memeriksa jatah. (spine AD-5, AD-9)
- B6: Lima pemeriksa di `src/core/grading` (formula_present, not_hard_coded, value_equals_key, uses_functions, uses_reference) dengan fixture emas dan tes paritas macro/upload. (spine AD-3, Conventions › Testing)
- B7: Gerak Results hanya CSS dengan bingkai statis dan `useMotionPreference`. (spine AD-12)
- B8: Kebijakan retensi `attempt-files` diputuskan bersama penilaian. (Parked epic 2)

## Done when

1. Tes paritas di CI memberi skor dan alasan identik untuk fixture yang sama lewat route macro dan upload; di Production satu percobaan dinilai lewat macro dan satu lewat upload, masing-masing dengan skor dan alasan.
2. Angka yang diketik dan fungsi yang salah dinilai salah dengan alasan tertulis; skor = poin soal benar − 5 per hint, minimal 0.
3. Hint dibuka untuk soal yang dipilih, jatah berkurang, dan potongan −5 tercatat untuk percobaan itu.
4. Results tampil sendiri setelah dinilai: soal salah + alasan, deretan Tips untuk semua soal, suasana tenang di bawah 80; varian Test lulus (efek api) dibuktikan dengan Result fixture; penilaian gagal menampilkan "Try again", dan pesan penilaian lambat muncul setelah 15 s.
5. Tips & Tricks memuat semua kartu yang pernah tampil dengan filter level dan pencarian; History membuka lagi hasil lama; keduanya punya keadaan kosong.
6. Semua di atas berjalan di Production.

## Boundaries

Penilaian, hint, Results, Tips & Tricks, History. Bukan: progres, streak, gerbang level (epic 4), konten penuh Level 1–4 dan item Test asli (epic 5). Milik epic 4: tombol "Practice again" di Results (CAP-19), badge "New record" (CAP-11), History List dan skor terakhir di Dashboard, serta "Level N unlocked!" dan tautan ke Level Map (CAP-1, CAP-9).

## References

- parent — _bmad-output/initiative-excel-practice/initiative-excel-practice.md
- spec — _bmad-output/specs/spec-excel-practice/SPEC.md, CAP-5, CAP-7, CAP-8, CAP-21
- constraint — _bmad-output/specs/spec-excel-practice/level-curriculum.md (fungsi khusus Microsoft 365 dilarang di hint dan Tips)
- architecture — _bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md, sections AD-1, AD-3, AD-5, AD-6, AD-7, AD-9, AD-10, AD-11, AD-12
- design — _bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md, sections Results, Score Badge, Wrong Answer Row, Tips Card, Tips Carousel, Fire Effect, Hint Button, Hint Select, State Patterns (Exam in progress, Results, History, Tips & Tricks)
- design — _bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/DESIGN.md, Results layout, Score Badge, Wrong Answer Row, Tips Card, Tips Carousel, Fire Effect, Hint Select, Hint Button
- design — _bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/mockups/key-results.html
- design — _bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/mockups/key-exam.html
- epic sebelumnya — _bmad-output/initiative-excel-practice/epic-percobaan-kiriman-file/epic-percobaan-kiriman-file.md
- deferred — _bmad-output/implementation-artifacts/deferred-work.md (entri berstatus moved — epic 3)

## Notes

- Waits on epic-percobaan-kiriman-file because: butuh kontrak LevelModule, snapshot percobaan, dan file berstatus received.
- Parked (dari epic 2, refactor sweep 2.11, 2026-11-09), diputuskan bersama penilaian:
  - File `attempt-files/<id>/` yatim saat baris percobaan dihapus (jalur kompensasi Start, cascade profil) dan `submission-1` yang yatim (review 2.3 #10): butuh kebijakan hapus Storage atau job pembersih; retensi `submission-<n>` diputuskan di sini karena penilaian pembaca pertamanya.
  - Database tidak memagari tulisan status service role terhadap AD-5 (hanya mesin TS), dan Abandon pada percobaan `received` saat penilaian berjalan membuat compare-and-set grader kembali `lost`: putuskan trigger cek dan penanganan `lost` bersama grader, penulis status service role kedua.
- Decision: tracer bullet = entry 1 (L01-P1 dinilai setelah Finish → halaman Results minimal muncul sendiri di Production), yang juga menetapkan kontrak `Result` lengkap (per soal: benar, poin, `reasonText`, Tip; plus `hintsUsed` dan skor) (user, 2026-11-09).
- Decision: urutan — setelah 1 jalur paralel pemeriksa (2), penilaian gagal + pagar AD-5 + harness DOM (3), dan kontrak hint/Tips + konten L01-P1 (4); lalu hint (5, setelah 3 dan 4) dan Results (6, setelah 3 dan 4); lalu gerak Results (7) dan History (8); Tips & Tricks (9, setelah 8); refactor sweep (10); uji Production (11). Slice paling tidak pasti setelah tracer = entry 2 (user, 2026-11-09).
- Decision: cakupan yang ditunda — "Practice again", "New record", History List Dashboard, dan "Level N unlocked!" ke epic 4; item Test asli ke epic 5; pembersihan `attempt-files` ditunda (lihat U7) (user, 2026-11-09).
- Decision (U1): `Result` disimpan di kolom `attempts.result` (jsonb) yang ditulis dalam UPDATE compare-and-set yang sama dengan status `graded`; `resultId` = id percobaan; Results di `/results/<attemptId>` (user, 2026-11-09).
- Decision (U2): `reasonText` berasal dari templat bahasa Indonesia per pemeriksa di `src/core/grading` (diisi sel dan nama fungsi), bukan dari konten; core tidak mengimpor `src/messages` (user, 2026-11-09).
- Decision (U3): hint dibuka lewat RPC `reveal_hint` (jatah + hanya saat `open` dalam satu transaksi) yang dijalankan service role setelah sesi dan kepemilikan percobaan dicek, seperti upload; AD-9 diubah untuk jalur hint (user, 2026-11-09).
- Decision (U4): percobaan yang macet di `received` (mis. `after()` terhenti) dinilai ulang oleh endpoint status lewat `after()` setelah 15 s di `received`; compare-and-set menjaga satu penulis (user, 2026-11-09).
- Decision (U5): snapshot v2 wajib memuat hint, Tip, dan `hintQuota`; daftar snapshot AD-3 di spine diperbarui; snapshot lama tanpa field itu tidak dinilai (tidak ada percobaan berjalan di `prod`) (user, 2026-11-09).
- Decision (U6): History dan koleksi Tips hanya membaca percobaan `graded` yang punya `Result`; baris uji 2.12 yang diset `graded` lewat SQL dibiarkan dan tidak tampil (user, 2026-11-09).
- Decision (U7): pembersihan `attempt-files` ditunda — satu user, volume kecil; file `submission-<n>` percobaan yang dinilai disimpan untuk penilaian ulang dan regresi (user, 2026-11-09).
- Decision (U8): harness tes DOM (jsdom + testing-library) dibangun di epic ini di entry 3; epic 4 memakainya untuk entri tertunda yang menunggu harness (user, 2026-11-09).
- Decision (U9): varian Results Test lulus (judul "Test passed — N/100" + Fire Effect) dibangun di epic ini dan dibuktikan dengan Result fixture; item Test asli di epic 5, "Level N unlocked!" di epic 4 (user, 2026-11-09).
- Decision: epic 4 menunggu entry 3.1 (Result tersimpan) dan epic 5 menunggu entry 3.2 (pemeriksa) dan 3.4 (kontrak hint/Tips), dipasang di `after` envelope masing-masing (2026-11-09).
- Decision: 3.1 done — Production 2026-11-10: attempt `7ee570ef` (L01-P1) dinilai otomatis 0,4 s setelah diterima lewat macro, Results muncul sendiri dengan 45/100 dan 2 of 4 correct (user, 2026-11-10).
- Decision: 3.2 done — tiga fixture Excel 2021 dinilai 100 / 80 / 75 lewat macro dan upload (CI), PR #16 di-merge, dan di Production attempt L01-P1 yang semua benar tampil 100/100 (user, 2026-11-11).
- Touch point: harness tes DOM (dari epic 4 ke entry 3), `src/core/progress` (dibuat di entry 9, dipakai epic 4), perubahan spine AD-3 (snapshot) dan AD-9 (jalur hint).
