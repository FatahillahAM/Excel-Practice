---
id: SPEC-excel-practice
companions:
  - level-curriculum.md
  - exam-bridge.md
  - content-generation.md
  - pivot-grading.md
  - stack.md
sources:
  - ../../planning-artifacts/briefs/brief-excel-practice-2026-10-22/brief.md
  - ../../planning-artifacts/briefs/brief-excel-practice-2026-10-22/addendum.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# WORKING HARD with EXCEL

## Why

**Pain + visi pribadi.** Satu pengguna (user sendiri) bekerja dengan data operasional manufaktur tetapi skill Excel-nya baru sebatas SUM/AVERAGE, sementara posisi incaran (supervisor, konsultan, staff planning, analis manufaktur) menuntut laporan analisa multi-sheet dengan Summary, Pivot dari file lain, dan file yang terhubung/diedit bersama. Tutorial dan video tidak membuatnya belajar; ia hanya belajar dengan mengerjakan langsung di Excel, dan materi latihan umum memakai data generik yang jauh dari pekerjaannya. Belajar mandiri dengan waktu fleksibel mudah berhenti tanpa jalur jelas dan alasan untuk kembali. Produk ini memberi jalur level bertahap, latihan di Excel desktop asli dengan data manufaktur yang selalu baru, penilaian otomatis, dan hook kembali (streak, rekor waktu, level terbuka).

## Capabilities

Fase: **V1** = build pertama; **Next** = build berikutnya (via `bmad-build`). Aturan per level, Test, dan Ujian Akhir: `level-curriculum.md`. Alur Exam: `exam-bridge.md`.

- **CAP-1** (V1)
  - **intent:** User melihat peta 9 level + Ujian Akhir dan membuka level secara bertahap.
  - **success:** Pada progres kosong hanya Level 1 yang bisa dimulai; lulus Test Level N membuka Level N+1; Level 5–9 dan Ujian Akhir tampil berlabel *Under Construction* dan tidak bisa dimulai.
- **CAP-2** (V1)
  - **intent:** User menekan *Mulai* di web untuk latihan/Test dan mendapat file soal `.xlsm` baru yang dikerjakan di Excel desktop.
  - **success:** *Mulai* mengunduh `.xlsm` berisi skenario, data, perintah soal, dan tombol *Selesai*, yang terbuka dan bisa dikerjakan di Excel 2021; waktu mulai tercatat di server.
- **CAP-3** (V1)
  - **intent:** User menekan *Selesai* di dalam file untuk mengirim jawaban tanpa upload manual.
  - **success:** Dengan macro aktif di Excel 2021, *Selesai* menyimpan file, mengirimnya ke server, menutup workbook (dan Excel bila tak ada workbook lain), lalu hasil tampil di web tanpa langkah lain.
- **CAP-4** (V1)
  - **intent:** User mengupload file yang sudah dikerjakan lewat web saat macro diblokir atau gagal.
  - **success:** File yang sama yang dikirim lewat macro dan lewat upload mendapat skor dan keterangan identik; upload berhasil di perangkat dengan macro diblokir.
- **CAP-5** (V1)
  - **intent:** User menerima skor, waktu, dan keterangan per soal (benar/salah dan kenapa), dinilai dari hasil maupun metode.
  - **success:** Sel berisi rumus dengan fungsi yang diminta dan hasil benar dinilai benar; sel berisi angka benar yang diketik manual atau fungsi yang salah dinilai salah dengan alasan tertulis; setiap soal menampilkan alasannya.
- **CAP-6** (V1)
  - **intent:** Setiap percobaan memberi soal baru dengan data acak dan kunci jawaban yang dijamin cocok dengan data itu.
  - **success:** Dua percobaan berturut-turut pada level yang sama memakai data berbeda; kunci jawaban sama dengan hasil hitung ulang dari data; perintah soal hanya merujuk kolom/entitas yang ada di data; bank berisi minimal 10 skenario per level.
- **CAP-7** (V1)
  - **intent:** User bisa membuka hint di web selama percobaan berjalan, dengan konsekuensi pengurangan poin.
  - **success:** Hint dibuka dari halaman web percobaan yang aktif dan tercatat di server untuk percobaan itu, baik file dikirim lewat macro maupun upload; tiap hint mengurangi 5 poin; jatah hint 3 (Level 1–4), 2 (Level 5–7), 1 (Level 8–9), 0 (Ujian Akhir).
- **CAP-8** (V1)
  - **intent:** Setelah setiap soal selesai, user melihat kartu Tips & Trick berisi cara lebih cepat/rapi, termasuk shortcut keyboard.
  - **success:** Setiap soal yang dinilai menampilkan satu kartu Tips yang relevan dengan tugasnya, dan kartu itu memuat minimal satu shortcut keyboard bila ada yang relevan.
- **CAP-9** (V1)
  - **intent:** User menutup setiap level dengan Test yang menggerbang level berikutnya.
  - **success:** Test hanya bisa dimulai setelah 5 latihan level itu diselesaikan (skor berapa pun); skor ≥80 sekali meluluskan Test dan membuka level berikutnya; hint boleh dipakai dan mengurangi poin; tidak ada batas waktu, tetapi waktu tercatat untuk rekor.
- **CAP-10** (V1)
  - **intent:** User menjaga streak harian dengan satu latihan singkat per hari dan bisa memakai freeze manual.
  - **success:** Hari dengan ≥1 latihan selesai menambah streak; hari terlewat tanpa freeze mereset streak; freeze yang diaktifkan user menutup satu hari; freeze ke-3 dalam satu minggu ditolak.
- **CAP-11** (V1)
  - **intent:** User melihat dan berusaha mengalahkan rekor waktu pribadi untuk setiap latihan, Test, dan Ujian Akhir.
  - **success:** Setiap percobaan, lulus maupun gagal, mencatat waktu dan bisa menjadi rekor; waktu terbaik per item ditampilkan; percobaan yang lebih cepat menggantikan rekor dan ditandai sebagai rekor baru.
- **CAP-12** (V1)
  - **intent:** Progres (level, skor, streak, freeze, rekor) tersimpan di cloud dan sama di semua perangkat user.
  - **success:** Test yang diselesaikan di laptop pribadi langsung terlihat (level terbuka, streak, rekor) saat web dibuka di PC kantor, dan sebaliknya.
- **CAP-13** (Next)
  - **intent:** User berlatih Level 5–9 (Rapikan data, Rumus modern, Pivot, Lintas file, Summary) beserta Test-nya.
  - **success:** Kelima level bisa dimainkan dengan alur Exam yang sama, skenario dibuat AI, dan label *Under Construction* hilang; file sumber Level 8 dikerjakan di folder lokal dan link-nya tetap jalan di laptop maupun PC kantor; PivotTable dinilai menurut `pivot-grading.md`; semua ini tanpa perubahan pada mesin Exam, penilaian, streak, atau UI peta level.
- **CAP-14** (Next)
  - **intent:** User mengerjakan Ujian Akhir — beberapa file data mentah menjadi laporan multi-sheet + Summary + Pivot dari file lain — untuk membuktikan kelulusan.
  - **success:** Tiap percobaan memakai skenario yang dibuat saat itu juga dan data yang berbeda total dari percobaan sebelumnya; lolos = ≤60 menit, 0 hint, skor ≥90; pada menit ke-60 file otomatis disimpan, dikirim, dan Excel ditutup, lalu percobaan dinyatakan selesai dan dinilai apa adanya; penghitung lolos naik hanya bila berturut-turut dan reset ke nol pada kegagalan; status *Lulus* muncul pada hitungan ke-5.
- **CAP-15** (Next)
  - **intent:** User berlatih co-authoring di OneDrive lewat jalur sampingan berisi latihan dan Tips.
  - **success:** Jalur sampingan tampil terpisah dari jalur level, berisi latihan dan kartu Tips, tanpa skor otomatis dan tanpa memengaruhi gerbang level.
- **CAP-16** (V1)
  - **intent:** User mendapat panduan di web untuk menyiapkan Excel sekali jalan agar macro di file soal bisa berjalan.
  - **success:** Web menampilkan langkah *Trusted Location* dan *Unblock* file untuk Excel 2021; setelah panduan diikuti di laptop pribadi, tombol *Selesai* pada file soal yang diunduh berjalan; panduan mengarahkan ke jalur upload bila macro tetap diblokir.
- **CAP-17** (V1)
  - **intent:** Hanya user yang bisa masuk ke web, dengan satu akun yang sama di laptop pribadi dan PC kantor.
  - **success:** Tanpa login, halaman progres, Mulai, hint, dan upload tidak bisa diakses; login dengan akun user berhasil di kedua perangkat; tidak ada halaman pendaftaran.
- **CAP-18** (V1)
  - **intent:** Server memastikan setiap file kiriman (macro maupun upload) memang milik user dan berasal dari percobaannya.
  - **success:** File dari *Mulai* milik user diterima dan dinilai untuk percobaan yang benar; file dengan identitas percobaan yang hilang, diubah, milik percobaan yang sudah dinilai, atau tidak dikenal ditolak dengan pesan alasan dan tidak dinilai.

## Constraints

- Semua latihan, Test, dan Ujian Akhir dikerjakan di Excel desktop asli; tidak ada spreadsheet simulasi di browser.
- Hanya fungsi/fitur yang tersedia di Office 2021; fungsi khusus Microsoft 365 dilarang di kurikulum, perintah soal, dan kunci jawaban (daftar: `level-curriculum.md`).
- Kunci jawaban dihitung program dari data hasil generator; AI hanya menulis cerita dan perintah soal, dan setiap skenario wajib terikat ke template/skema data generator (`content-generation.md`).
- Penilaian hanya di server dengan satu set aturan; macro hanya menyimpan dan mengirim file. File yang sama = skor yang sama, apa pun jalurnya.
- Jalur upload cadangan harus selalu berfungsi, karena macro dari file unduhan diblokir secara default dan PC kantor mungkin melarang macro.
- Tidak ada instalasi aplikasi lokal di perangkat user (PC kantor kemungkinan memblokir instalasi).
- Data dan skenario hanya dari domain kerja user: produksi, maintenance, kaizen, time study, kapasitas gudang.
- Web app di-hosting dengan penyimpanan cloud, bukan localhost.
- Level adalah modul konten: menambah level tidak boleh mengubah mesin Exam, penilaian, streak, atau UI peta level.
- Kunci Claude API disimpan di server, tidak pernah di file Excel.
- V1 dibatasi Level 1–4 + mesin Exam lengkap agar bisa dipakai berlatih selagi level berikutnya dibangun; V1 tidak memanggil AI saat runtime (skenario Level 1–4 dari bank yang dibuat saat build).

## Non-goals

- Akun banyak pengguna, leaderboard, monetisasi.
- Fungsi khusus Microsoft 365 (LAMBDA, VSTACK/HSTACK, TEXTSPLIT, TAKE/DROP, GROUPBY/PIVOTBY).
- Penilaian otomatis co-authoring.
- Aplikasi pendamping lokal dan Office Add-in sebagai jembatan Exam.
- Materi pasif (video, bacaan tutorial) sebagai cara belajar utama.
- Materi di luar Excel (VBA/macro, Power BI, dashboard lanjutan) — visi pasca-lulus dengan mesin yang sama (level, Test, Exam di aplikasi asli, streak, rekor), bukan spec ini.

## Success signal

- **V1:** User menyelesaikan latihan dan Test Level 1–4 sepenuhnya lewat *Mulai* → `.xlsm` di Excel desktop → *Selesai* → skor + keterangan per soal di web di laptop pribadi; jalur upload menilai file yang sama secara identik di PC kantor; progres terlihat sama di kedua perangkat.
- **Akhir:** User lolos Ujian Akhir 5 kali berturut-turut — masing-masing ≤60 menit, tanpa hint, skor ≥90/100, dengan data dan skenario berbeda total tiap percobaan.

## Assumptions

- Laptop pribadi memakai Office 2021 (belum diverifikasi user).
- Kartu Tips & Trick tampil per soal di halaman hasil web, setelah file dinilai.
- Waktu percobaan dihitung dari *Mulai* (dicatat server) sampai file diterima server, sama untuk jalur macro dan upload.
- Jatah hint berlaku per percobaan (latihan atau Test), bukan total seluruh percobaan di level itu.
- Pengurangan per hint tetap 5 poin di semua level, jadi potongan maksimal 15 (Level 1–4), 10 (Level 5–7), 5 (Level 8–9).
- Login memakai satu akun username + password; username saja tanpa password tidak cukup karena web bisa diakses internet. (CAP-17)
- Skenario Level 5–9 dibuat AI saat runtime via Claude API, sama seperti Ujian Akhir, bukan dari bank saat build. (CAP-13)
- Folder kerja lokal memakai satu nama tetap yang sekaligus dijadikan *Trusted Location* lewat panduan CAP-16; semua file satu percobaan diletakkan di folder itu. (CAP-13, CAP-14, CAP-16)
- Penutupan otomatis di menit ke-60 mengikuti aturan tombol *Selesai*: Excel ditutup hanya bila tidak ada workbook lain yang terbuka. (CAP-14)
- Ujian Akhir lewat jalur upload: server menutup percobaan di menit ke-60; upload sesudahnya ditolak dan percobaan dihitung tidak lolos. (CAP-14)
- **Rekomendasi streak, menunggu konfirmasi user** (CAP-10):
  - Syarat harian: minimal satu percobaan (latihan, Test, atau Ujian Akhir) dinilai, skor berapa pun.
  - Batas hari 00:00 di satu zona waktu tetap yang disimpan di profil (diambil dari perangkat saat pertama login), sama untuk laptop dan PC kantor.
  - Kuota 2 freeze per minggu Senin–Minggu, reset Senin 00:00, sisa tidak terbawa; freeze diaktifkan untuk hari ini sebelum batas hari dan tidak bisa berlaku mundur.

## Open Questions

- (Next) Setujui penilaian Pivot berlapis di `pivot-grading.md`? Spike dengan file Office 2021 menentukan lapisan mana yang dipakai, sebelum Level 7 dibangun. (CAP-13, CAP-14)
