---
id: SPEC-excel-practice
companions:
  - level-curriculum.md
  - exam-bridge.md
  - content-generation.md
  - pivot-grading.md
  - stack.md
  - ../../planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/DESIGN.md
  - ../../planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md
sources:
  - ../../planning-artifacts/briefs/brief-excel-practice-2026-10-22/brief.md
  - ../../planning-artifacts/briefs/brief-excel-practice-2026-10-22/addendum.md
  - ../../planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/spec-update-candidates.md
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# WORKING HARD with EXCEL

## Why

**Pain + visi pribadi.** Satu pengguna (user sendiri) bekerja dengan data operasional manufaktur tetapi skill Excel-nya baru sebatas SUM/AVERAGE, sementara posisi incaran (supervisor, konsultan, staff planning, analis manufaktur) menuntut laporan analisa multi-sheet dengan Summary, Pivot dari file lain, dan file yang terhubung/diedit bersama. Tutorial dan video tidak membuatnya belajar; ia hanya belajar dengan mengerjakan langsung di Excel, dan materi latihan umum memakai data generik yang jauh dari pekerjaannya. Belajar mandiri dengan waktu fleksibel mudah berhenti tanpa jalur jelas dan alasan untuk kembali. Produk ini memberi jalur level bertahap, latihan di Excel desktop asli dengan data manufaktur yang selalu baru, penilaian otomatis, dan hook kembali (streak, rekor waktu, level terbuka).

## Capabilities

Fase: **V1** = build pertama; **Next** = build berikutnya (via `bmad-build`). Aturan per level, Test, dan Ujian Akhir: `level-curriculum.md`. Alur Exam: `exam-bridge.md`. Layar, state, dan teks: `EXPERIENCE.md`; tampilan: `DESIGN.md`.

- **CAP-1** (V1)
  - **intent:** User melihat peta 9 level + Ujian Akhir dan membuka level secara bertahap.
  - **success:** Pada progres kosong hanya Level 1 yang bisa dimulai; lulus Test Level N membuka Level N+1; Level 5–9 dan Ujian Akhir tampil berlabel *Under Construction* dan tidak bisa dimulai; jalur sampingan (CAP-15) tampil sebagai satu node *Under Construction* di samping jalur utama; di V1, lulus Test Level 4 menampilkan "Level 4 complete! Level 5 is coming soon" tanpa membuka level baru.
- **CAP-2** (V1)
  - **intent:** User menekan *Start* di web untuk latihan/Test dan mendapat file soal `.xlsm` baru yang dikerjakan di Excel desktop.
  - **success:** *Start* mengunduh `.xlsm` berisi sheet *Instructions* (skenario + perintah soal), data, dan tombol *Finish*, yang terbuka dan bisa dikerjakan di Excel 2021; waktu mulai tercatat di server.
- **CAP-3** (V1)
  - **intent:** User menekan *Finish* di dalam file untuk mengirim jawaban tanpa upload manual.
  - **success:** Dengan macro aktif di Excel 2021, *Finish* menyimpan file, mengirimnya ke server, menampilkan pesan terkirim, menutup workbook (dan Excel bila tak ada workbook lain), lalu hasil tampil di web tanpa langkah lain; bila pengiriman gagal, workbook tetap terbuka dengan pesan yang mengarahkan ke upload.
- **CAP-4** (V1)
  - **intent:** User mengupload file yang sudah dikerjakan lewat web saat macro diblokir atau gagal.
  - **success:** File yang sama yang dikirim lewat macro dan lewat upload mendapat skor dan keterangan identik; upload berhasil di perangkat dengan macro diblokir.
- **CAP-5** (V1)
  - **intent:** User menerima skor, waktu, dan keterangan per soal, dinilai dari hasil maupun metode.
  - **success:** Sel berisi rumus dengan fungsi yang diminta dan hasil benar dinilai benar; sel berisi angka benar yang diketik manual atau fungsi yang salah dinilai salah dengan alasan tertulis; hasil menampilkan jumlah soal benar ("x of y correct") dan alasan untuk setiap soal yang salah.
- **CAP-6** (V1)
  - **intent:** Setiap percobaan memberi soal baru dengan data acak dan kunci jawaban yang dijamin cocok dengan data itu.
  - **success:** Dua percobaan berturut-turut pada level yang sama memakai data berbeda; kunci jawaban sama dengan hasil hitung ulang dari data; perintah soal hanya merujuk kolom/entitas yang ada di data; bank berisi minimal 10 skenario per level.
- **CAP-7** (V1)
  - **intent:** User bisa membuka hint di web selama percobaan berjalan, dengan konsekuensi pengurangan poin.
  - **success:** Hint dibuka dari halaman web percobaan yang aktif untuk soal yang dipilih user dan tercatat di server untuk percobaan itu, baik file dikirim lewat macro maupun upload; tiap hint mengurangi 5 poin dan memakai satu jatah; jatah hint 3 (Level 1–4), 2 (Level 5–7), 1 (Level 8–9), 0 (Ujian Akhir).
- **CAP-8** (V1)
  - **intent:** Setelah setiap soal dinilai, user melihat kartu Tips & Trick berisi cara lebih cepat/rapi, termasuk shortcut keyboard, dan bisa membukanya lagi kapan saja.
  - **success:** Setiap soal yang dinilai, benar maupun salah, menampilkan satu kartu Tips yang relevan dengan tugasnya, memuat minimal satu shortcut keyboard bila ada yang relevan; setiap kartu yang pernah tampil masuk koleksi Tips & Tricks yang bisa difilter per level dan dicari.
- **CAP-9** (V1)
  - **intent:** User menutup setiap level dengan Test yang menggerbang level berikutnya.
  - **success:** Test hanya bisa dimulai setelah 5 latihan level itu diselesaikan (skor berapa pun); skor ≥80 sekali meluluskan Test dan membuka level berikutnya; Test yang gagal bisa langsung diulang tanpa latihan tambahan; hint boleh dipakai dan mengurangi poin; tidak ada batas waktu, tetapi waktu tercatat untuk rekor.
- **CAP-10** (V1)
  - **intent:** User menjaga streak harian dengan minimal satu percobaan per hari dan bisa memakai freeze manual.
  - **success:** Hari dengan ≥1 percobaan dinilai (latihan, Test, atau Ujian Akhir; skor berapa pun) menambah streak; batas hari 00:00 di zona waktu yang ditetapkan saat login pertama dan tidak bisa diubah; hari terlewat tanpa freeze mereset streak; user memasang freeze untuk hari ini sebelum batas hari, tidak bisa berlaku mundur; kuota 2 freeze per minggu Senin–Minggu, reset Senin 00:00, sisa tidak terbawa, freeze ke-3 ditolak; web menunjukkan bila hari ini belum aman beserta sisa waktunya.
- **CAP-11** (V1)
  - **intent:** User melihat dan berusaha mengalahkan rekor waktu pribadi untuk setiap latihan, Test, dan Ujian Akhir.
  - **success:** Setiap percobaan, lulus maupun gagal, mencatat waktu dan bisa menjadi rekor; waktu terbaik per item ditampilkan; percobaan yang lebih cepat menggantikan rekor dan ditandai sebagai rekor baru.
- **CAP-12** (V1)
  - **intent:** Progres (level, skor, streak, freeze, rekor, percobaan terbuka) tersimpan di cloud dan sama di semua perangkat user.
  - **success:** Test yang diselesaikan di laptop pribadi langsung terlihat (level terbuka, streak, rekor) saat web dibuka di PC kantor atau HP, dan sebaliknya; di HP user bisa melihat progres dan streak serta memasang freeze, sedangkan *Start* dan *Practice again* tidak membuat percobaan dan menampilkan pesan untuk memakai laptop.
- **CAP-13** (Next)
  - **intent:** User berlatih Level 5–9 (Rapikan data, Rumus modern, Pivot, Lintas file, Summary) beserta Test-nya.
  - **success:** Kelima level bisa dimainkan dengan alur Exam yang sama, skenario dibuat AI, dan label *Under Construction* hilang; file sumber Level 8 dikerjakan di folder lokal dan link-nya tetap jalan di laptop maupun PC kantor; PivotTable dinilai menurut `pivot-grading.md`; semua ini tanpa perubahan pada mesin Exam, penilaian, streak, atau UI peta level.
- **CAP-14** (Next)
  - **intent:** User mengerjakan Ujian Akhir — beberapa file data mentah menjadi laporan multi-sheet + Summary + Pivot dari file lain — untuk membuktikan kelulusan.
  - **success:** Tiap percobaan memakai skenario yang dibuat saat itu juga dan data yang berbeda total dari percobaan sebelumnya; lolos = ≤60 menit, 0 hint, skor ≥90; sisa waktu tampil di layar percobaan; pada menit ke-60 file otomatis disimpan, dikirim, dan Excel ditutup, lalu percobaan dinyatakan selesai dan dinilai apa adanya; penghitung lolos naik hanya bila berturut-turut dan reset ke nol pada kegagalan; status *Lulus* muncul pada hitungan ke-5.
- **CAP-15** (Next)
  - **intent:** User berlatih co-authoring di OneDrive lewat jalur sampingan berisi latihan dan Tips.
  - **success:** Jalur sampingan tampil terpisah dari jalur level, berisi latihan dan kartu Tips, tanpa skor otomatis dan tanpa memengaruhi gerbang level.
- **CAP-16** (V1)
  - **intent:** User mendapat panduan di web untuk menyiapkan Excel sekali jalan agar macro di file soal bisa berjalan.
  - **success:** Web menampilkan langkah untuk Excel 2021: satu folder kerja tetap sebagai lokasi simpan setiap `.xlsm` sekaligus *Trusted Location*, dan *Unblock* file bila perlu; setelah panduan diikuti di laptop pribadi, tombol *Finish* pada file soal yang diunduh berjalan; panduan mengarahkan ke jalur upload bila macro tetap diblokir.
- **CAP-17** (V1)
  - **intent:** Hanya user yang bisa masuk ke web, dengan akun Google yang sama di semua perangkatnya.
  - **success:** Tanpa login, halaman progres, *Start*, hint, dan upload tidak bisa diakses; *Sign in with Google* dengan akun yang diizinkan berhasil di laptop, PC kantor, dan HP, dan sesi diingat ±30 hari per perangkat; akun Google lain ditolak tanpa sesi; tidak ada pendaftaran dan tidak ada password.
- **CAP-18** (V1)
  - **intent:** Server memastikan setiap file kiriman (macro maupun upload) memang milik user dan berasal dari percobaannya.
  - **success:** File dari *Start* milik user diterima dan dinilai untuk percobaan yang benar; file ditolak dan tidak dinilai, dengan pesan berbeda untuk tiap alasan — bukan dari percobaan yang sedang berjalan, sudah dinilai, identitas diubah atau rusak, percobaan sudah ditutup — baik lewat macro maupun upload; percobaan tetap terbuka kecuali alasannya percobaan sudah ditutup.
- **CAP-19** (V1)
  - **intent:** User bisa mengulang latihan atau Test yang sudah selesai untuk berlatih lagi dan mengejar rekor.
  - **success:** *Practice again* pada latihan atau Test yang sudah selesai memulai percobaan baru dengan data baru; hasilnya dihitung untuk streak dan rekor; jumlah latihan selesai, gerbang Test, dan status level tidak berubah.
- **CAP-20** (V1)
  - **intent:** User bisa kembali ke, atau membatalkan, percobaan yang sedang terbuka dari perangkat mana pun.
  - **success:** Hanya ada satu percobaan terbuka (belum dinilai); selama terbuka, *Start* dan *Practice again* lain terkunci; *Resume* membuka lagi layar percobaan dengan waktu sejak *Start* dan hint yang sudah dibuka; *Abandon* membatalkan percobaan tanpa dinilai; unduh ulang memberi file yang sama tanpa mengubah waktu mulai; penilaian yang gagal bisa diulang tanpa mengirim ulang file.
- **CAP-21** (V1)
  - **intent:** User bisa membuka lagi hasil percobaan lama untuk belajar dari kesalahan.
  - **success:** History menampilkan percobaan yang sudah dinilai; membuka satu percobaan menampilkan lagi skor, waktu, soal yang salah beserta alasannya, dan kartu Tips-nya.

## Constraints

- Semua latihan, Test, dan Ujian Akhir dikerjakan di Excel desktop asli; tidak ada spreadsheet simulasi di browser.
- Hanya fungsi/fitur yang tersedia di Office 2021; fungsi khusus Microsoft 365 dilarang di kurikulum, perintah soal, hint, kartu Tips, dan kunci jawaban (daftar: `level-curriculum.md`).
- Kunci jawaban dihitung program dari data hasil generator; AI hanya menulis cerita dan perintah soal, dan setiap skenario wajib terikat ke template/skema data generator (`content-generation.md`).
- Penilaian hanya di server dengan satu set aturan; macro hanya menyimpan dan mengirim file. File yang sama = skor yang sama, apa pun jalurnya.
- Jalur upload cadangan harus selalu berfungsi, karena macro dari file unduhan diblokir secara default dan PC kantor mungkin melarang macro.
- Tidak ada instalasi aplikasi lokal di perangkat user (PC kantor kemungkinan memblokir instalasi).
- Data dan skenario hanya dari domain kerja user: produksi, maintenance, kaizen, time study, kapasitas gudang.
- Web app di-hosting dengan penyimpanan cloud, bukan localhost.
- Level adalah modul konten: menambah level tidak boleh mengubah mesin Exam, penilaian, streak, atau UI peta level.
- Kunci Claude API disimpan di server, tidak pernah di file Excel.
- V1 dibatasi Level 1–4 + mesin Exam lengkap agar bisa dipakai berlatih selagi level berikutnya dibangun; V1 tidak memanggil AI saat runtime (skenario Level 1–4 dari bank yang dibuat saat build).
- Bahasa: judul, tombol, dan label UI dalam bahasa Inggris; perintah soal, keterangan, hint, kartu Tips, dan pesan sistem dalam bahasa Indonesia santai; nama menu, fungsi, dan shortcut Excel ditulis persis seperti Excel berbahasa Inggris; "Ujian Akhir" tetap dipakai sebagai nama (`EXPERIENCE.md` › Voice and Tone).

## Non-goals

- Akun banyak pengguna, leaderboard, monetisasi.
- Fungsi khusus Microsoft 365 (LAMBDA, VSTACK/HSTACK, TEXTSPLIT, TAKE/DROP, GROUPBY/PIVOTBY).
- Penilaian otomatis co-authoring.
- Aplikasi pendamping lokal dan Office Add-in sebagai jembatan Exam.
- Materi pasif (video, bacaan tutorial) sebagai cara belajar utama.
- Notifikasi push atau email; status streak hanya terlihat saat web dibuka.
- Materi di luar Excel (VBA/macro, Power BI, dashboard lanjutan) — visi pasca-lulus dengan mesin yang sama (level, Test, Exam di aplikasi asli, streak, rekor), bukan spec ini.

## Success signal

- **V1:** User menyelesaikan latihan dan Test Level 1–4 sepenuhnya lewat *Start* → `.xlsm` di Excel desktop → *Finish* → skor + keterangan per soal di web di laptop pribadi; jalur upload menilai file yang sama secara identik di PC kantor; progres terlihat sama di kedua perangkat.
- **Akhir:** User lolos Ujian Akhir 5 kali berturut-turut — masing-masing ≤60 menit, tanpa hint, skor ≥90/100, dengan data dan skenario berbeda total tiap percobaan.

## Assumptions

- Laptop pribadi memakai Office 2021 (belum diverifikasi user).
- Waktu percobaan dihitung dari *Start* (dicatat server) sampai file diterima server, sama untuk jalur macro dan upload.
- Jatah hint berlaku per percobaan (latihan atau Test), bukan total seluruh percobaan di level itu.
- Pengurangan per hint tetap 5 poin di semua level, jadi potongan maksimal 15 (Level 1–4), 10 (Level 5–7), 5 (Level 8–9).
- Skenario Level 5–9 dibuat AI saat runtime via Claude API, sama seperti Ujian Akhir, bukan dari bank saat build. (CAP-13)
- Semua file satu percobaan Level 8 dan Ujian Akhir diletakkan di folder kerja tetap dari CAP-16. (CAP-13, CAP-14)
- Penutupan otomatis di menit ke-60 mengikuti aturan tombol *Finish*: Excel ditutup hanya bila tidak ada workbook lain yang terbuka. (CAP-14)
- Ujian Akhir lewat jalur upload: server menutup percobaan di menit ke-60; upload sesudahnya ditolak dan percobaan dihitung tidak lolos. (CAP-14)

## Open Questions

- Bobot skor per soal: sama rata, atau berbeda per soal? Contoh di mock UX ("8 of 10 correct" dengan satu hint −5 = 85) hanya cocok bila bobot tidak rata. (CAP-5)
- (Next) Setujui penilaian Pivot berlapis di `pivot-grading.md`? Spike dengan file Office 2021 menentukan lapisan mana yang dipakai, sebelum Level 7 dibangun. (CAP-13, CAP-14)
