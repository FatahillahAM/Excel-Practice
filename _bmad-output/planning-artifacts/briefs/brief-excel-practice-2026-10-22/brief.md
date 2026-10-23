---
title: "Product Brief: WORKING HARD with EXCEL"
status: final
created: 2026-10-22
updated: 2026-10-22
---

# Product Brief: WORKING HARD with EXCEL

## Ringkasan

WORKING HARD with EXCEL adalah web app latihan pribadi untuk membawa skill Excel saya dari SUM/AVERAGE ke level Advanced yang dibutuhkan posisi supervisor, konsultan, staff planning, atau analis manufaktur. Semua latihan dikerjakan **di Excel desktop asli**. Saya menekan *Mulai* di web, mengerjakan file soal di Excel, menekan *Selesai*, lalu skor dan keterangannya langsung tampil di web.

Soal selalu baru dan bernuansa pekerjaan saya sendiri: produksi, maintenance, kaizen, time study, dan kapasitas gudang. AI menulis skenarionya, sementara program membuat data dan menghitung kunci jawabannya. Sembilan level bertahap, streak harian, dan rekor waktu pribadi menjaga saya tetap kembali berlatih. Garis finisnya jelas: lolos Ujian Akhir **5 kali berturut-turut, dalam 60 menit, tanpa hint, skor minimal 90**.

## Masalah

Saya bekerja dengan data operasional manufaktur (produksi, maintenance, kaizen (improvement), time study, dan kapasitas gudang (warehouse/finished goods)), tapi skill Excel saya baru sebatas SUM, AVERAGE, dan sejenisnya. Posisi yang saya incar menuntut lebih dari itu. Contoh pekerjaan yang harus bisa saya lakukan sendiri:

- membuat **laporan analisa dalam satu workbook**: beberapa sheet untuk mengolah data mentah dan satu sheet **Summary** berisi yang dicari atasan (before vs after, output vs target, top 5, grafik tren);
- membuat **Pivot yang mengambil data dari file Excel lain**;
- mengelola file yang **terhubung ke file lain** dan bisa **dipakai serta diedit bersama**.

Tutorial dan video tidak cukup untuk saya. Saya hanya benar-benar belajar kalau **mengerjakannya langsung di Excel**. Sebagian besar materi latihan juga memakai data generik (penjualan, nilai siswa) yang jauh dari pekerjaan saya. Tanpa jalur yang jelas dan alasan untuk terus kembali, belajar mandiri mudah berhenti di tengah jalan.

## Untuk Siapa

Untuk saya sendiri: satu pengguna, belajar mandiri dengan waktu fleksibel, berlatih di laptop pribadi (utama) dan PC kantor (sesekali). PC kantor memakai Office 2021; laptop pribadi diduga sama (perlu dicek ulang). Tidak ada pengguna lain.

## Kriteria Lulus

Saya dianggap **lulus** ketika bisa menyelesaikan **Ujian Akhir** (beberapa file data mentah manufaktur → satu laporan multi-sheet + Summary + Pivot dari file lain):

- dalam **60 menit**,
- **tanpa membuka hint sama sekali**,
- dengan **skor minimal 90/100**,
- dan berhasil **5 kali berturut-turut** (gagal sekali, hitungan kembali ke nol), **setiap kali dengan data dan skenario yang berbeda total**.

Yang dilatih adalah **hafal langkah**, bukan hafal jawaban. Lima kali lolos pada kasus yang berbeda membuktikan polanya sudah menjadi kebiasaan, bukan kebetulan. Ini versi terukur dari tujuan sebenarnya: *bisa memakai Excel untuk pekerjaan ini tanpa bantuan apa pun.*

## Solusi

**Jalur level.** Sembilan level bertahap, masing-masing melatih satu potongan skill yang nanti dipakai di Ujian Akhir:

1. Fondasi → 2. Logika → 3. Hitung bersyarat → 4. Cari data → 5. Rapikan data → 6. Rumus modern → 7. Pivot → 8. Lintas file → 9. Summary → 🏁 **Ujian Akhir**

Setiap level ditutup dengan **Test**: skor minimal 80, hint boleh dipakai (tapi mengurangi poin), tanpa batas waktu (waktu tetap dicatat untuk rekor), cukup lulus sekali untuk membuka level berikutnya. Test level adalah tempat **belajar**; Ujian Akhir tempat **membuktikan**. Bantuan makin berkurang: di level awal hint dan Tips tersedia penuh, makin tinggi levelnya hint makin sedikit, dan di Ujian Akhir hint tidak ada sama sekali. Ada juga jalur sampingan **co-authoring di OneDrive** berupa latihan dan Tips, tanpa penilaian otomatis. Rincian isi tiap level ada di addendum.

**Exam di Excel asli.** Semua latihan, Test, dan Ujian Akhir memakai alur Exam yang sama. Saya menekan *Mulai* di web, lalu file soal (`.xlsm`) diunduh dan dibuka di Excel desktop. Setelah selesai, saya menekan tombol **Selesai** di dalam file: file disimpan dan dikirim ke web, Excel tertutup, dan web langsung menampilkan **skor, waktu, dan keterangan** per soal (mana yang benar, mana yang salah, dan kenapa). Kalau macro bermasalah, ada jalur cadangan: kerjakan file, lalu upload ke web untuk dinilai. Penilaian selalu dilakukan di web dengan aturan yang sama, baik file dikirim lewat macro maupun upload.

**Soal selalu baru, kunci jawaban selalu benar.** AI menulis cerita dan perintah soal dengan nuansa pekerjaan saya; generator membuat data acak **dan menghitung kunci jawabannya**, jadi skor tidak bergantung pada hitungan AI. Skenario Level 1–4 diambil dari **bank skenario** yang dibuat saat build; skenario Ujian Akhir dibuat **saat itu juga** lewat Claude API supaya lima percobaan berturut-turut berbeda total.

**Tips & Trick.** Setiap kali satu soal selesai, muncul kartu singkat berisi cara yang lebih cepat atau lebih rapi untuk tugas itu, **termasuk shortcut keyboard**.

**Alasan untuk kembali.**
- **Streak harian**: cukup satu latihan singkat per hari supaya streak tetap hidup, dengan jatah **2 streak freeze per minggu** yang saya aktifkan sendiri saat dibutuhkan.
- **Rekor waktu pribadi**: setiap latihan, Test, dan Ujian Akhir mencatat waktu terbaik saya untuk dikalahkan.
- **Level baru terbuka** sebagai tanda kemajuan yang terlihat.

Progres tersimpan di cloud, jadi sama di laptop pribadi maupun PC kantor.

## Yang Membedakan

Ini proyek pribadi, jadi keunggulannya bukan teknologi rahasia, tapi **kecocokan dengan saya**:

- **Excel asli, bukan simulasi.** Situs latihan umumnya memakai spreadsheet tiruan di browser. Di sini saya berlatih di aplikasi yang sama dengan yang saya pakai di kantor, lengkap dengan shortcut dan kebiasaannya.
- **Data dan kasus dari dunia kerja saya**, bukan data penjualan toko.
- **Tidak bisa dihafal.** Setiap percobaan memakai data dan skenario baru, dengan kunci jawaban yang dihitung program.
- **Sesuai Office 2021.** Saya tidak akan belajar fungsi yang tidak tersedia di komputer kantor.

## Cakupan Versi Pertama

**Masuk:**
- Level 1–4 (Fondasi, Logika, Hitung bersyarat, Cari data) beserta Test masing-masing.
- Alur Exam lengkap: file `.xlsm` dengan tombol *Selesai*, jalur cadangan upload, penilaian di web, dan keterangan per soal.
- Bank skenario AI untuk Level 1–4 + generator data dan kunci jawaban.
- Kartu Tips & Trick (dengan shortcut) setelah setiap soal; hint yang mengurangi poin.
- Streak harian + 2 freeze per minggu, rekor waktu pribadi, level yang terbuka bertahap.
- Penyimpanan progres di cloud (laptop pribadi + PC kantor).
- Level 5–9 dan Ujian Akhir **sudah tampil di peta level** dengan label *Under Construction*.

**Belum masuk (build berikutnya):**
- Isi Level 5–9 (termasuk Power Query, Pivot, Lintas file, Summary) dan Ujian Akhir, termasuk pembuatan skenario saat runtime lewat Claude API (butuh API key dan biaya kecil per ujian).
- Jalur sampingan co-authoring OneDrive.

**Tidak akan dibuat:**
- Akun banyak pengguna, leaderboard, monetisasi.
- Fungsi khusus Microsoft 365 (LAMBDA, VSTACK, TEXTSPLIT, GROUPBY, dll.).
- Penilaian otomatis untuk co-authoring.

**Cara membangun:** sepenuhnya dengan Claude Code. Versi pertama ditargetkan selesai dalam satu build dan langsung bisa dipakai. Level 5–9 ditambahkan lewat `bmad-build` pada build berikutnya, jadi versi pertama harus membuat **penambahan level semudah menambah satu modul konten**, tanpa membongkar mesin Exam.

## Risiko & Pertanyaan Terbuka

- **Membangun menggerus waktu berlatih.** Diredam dengan versi pertama yang kecil: Level 1–4 sudah bisa dipakai berlatih sementara level berikutnya dibangun.
- **Macro diblokir.** Office memblokir macro di file yang diunduh dari internet secara default, dan PC kantor mungkin punya kebijakan yang lebih ketat. Perlu langkah penyiapan sekali (mis. folder *Trusted Location* di laptop pribadi); jalur upload cadangan harus selalu berfungsi.
- **Penilaian Pivot dari file lain** sulit diperiksa otomatis. Perlu dicari cara menilainya sebelum Level 7–8 dan Ujian Akhir dibangun.
- **Kualitas skenario AI.** Skenario bisa tidak masuk akal atau tidak cocok dengan data yang dibuat generator, jadi perlu aturan atau template yang mengikat keduanya.
- **Bank skenario Level 1–4 bisa terasa berulang** kalau terlalu kecil. Generator tetap mengacak angka datanya, tapi jumlah skenario per level perlu cukup banyak.
- **Sumber skenario Level 5–9** (bank atau runtime) belum diputuskan.
- **Versi Excel di laptop pribadi** perlu dicek ulang (diduga Office 2021).

## Visi

Setelah lulus Ujian Akhir, WORKING HARD with EXCEL tidak berhenti. Aplikasi ini menjadi tempat latihan untuk **materi berikutnya**, dengan mesin yang sama (level, Test, Exam di aplikasi asli, streak, rekor waktu). Kandidatnya: VBA/macro, Power BI, dan dashboard lanjutan. Aplikasi tetap untuk saya sendiri.
