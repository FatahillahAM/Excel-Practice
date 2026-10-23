---
title: "Addendum: WORKING HARD with EXCEL"
status: final
created: 2026-10-22
updated: 2026-10-22
---

# Addendum: WORKING HARD with EXCEL

Detail untuk dokumen lanjutan (PRD, UX, arsitektur) yang terlalu rinci untuk brief.

## Peta level (disetujui 2026-10-22)

| Level | Nama | Isi | Kategori user |
|---|---|---|---|
| 1 | Fondasi | Referensi `$`, Tabel Excel (Ctrl+T), Sort & Filter | dasar |
| 2 | Logika | IF, IFS, AND/OR, IFERROR | mengolah |
| 3 | Hitung bersyarat | COUNTIFS, SUMIFS, AVERAGEIFS, MAXIFS/MINIFS | mengolah |
| 4 | Cari data | VLOOKUP → XLOOKUP, INDEX-MATCH | mencari data |
| 5 | Rapikan data | TRIM, LEFT/MID/RIGHT, fungsi tanggal, Remove Duplicates, Power Query dasar | merapikan |
| 6 | Rumus modern | FILTER, UNIQUE, SORT, LET | mengolah |
| 7 | Pivot | PivotTable, PivotChart, Slicer | (ditambahkan) |
| 8 | Lintas file | External links, Pivot / Power Query dari file lain | (ditambahkan) |
| 9 | Summary | KPI, grafik, conditional formatting | (ditambahkan) |
| 🏁 | Ujian Akhir | Gabungan semua; 60 menit, tanpa hint, skor ≥90/100, 5 kali berturut-turut | |
| ➕ | Jalur sampingan | Co-authoring OneDrive (latihan + Tips, tidak dinilai otomatis) | |

Kolom *Kategori user* memetakan level ke skill inti yang disebut user (mencari data, merapikan, mengolah); *(ditambahkan)* berarti level di luar kategori itu, yang dibutuhkan Ujian Akhir.

Setiap level ditutup dengan Test untuk membuka level berikutnya (standar Test: skor ≥80, hint boleh tapi mengurangi poin, tanpa batas waktu ketat, cukup lulus sekali).

Catatan jalur sampingan: Shared Workbook versi lama sudah dipensiunkan; co-authoring butuh OneDrive/SharePoint, jadi sulit dinilai otomatis.

### Isi Summary yang dinilai di Level 9 & Ujian Akhir
- Perbandingan before vs after (mis. hasil kaizen)
- Total output vs target
- Top 5 (mesin downtime terlama, proses kerja terlama)
- Grafik tren

## Keputusan & risiko untuk arsitektur (bahan PRD / solution design)

### Jembatan Exam: opsi yang dipertimbangkan

Browser tidak bisa langsung membuka Excel desktop lalu mendeteksi saat Excel ditutup, jadi web dan Excel butuh jembatan.

| Opsi | Status | Alasan |
|---|---|---|
| A. Aplikasi pendamping lokal (buka Excel, deteksi tutup, nilai, kirim) | Ditolak | Paling mirip impian awal (Excel tertutup otomatis), tapi butuh instalasi; berisiko di PC kantor. |
| B. File `.xlsm` + tombol *Selesai* (macro) | **Jalur utama** | Tanpa instalasi; tombol membuat titik akhir timer jelas dan adil. |
| C. Unduh lalu upload manual | **Cadangan** | Pasti jalan di mana saja, termasuk saat macro diblokir. |
| D. Office Add-in (panel web di dalam Excel) | Tidak dilanjutkan | Disebut di awal diskusi, tapi tidak masuk pilihan akhir. |

Alur Opsi B: *Mulai* di web → file `.xlsm` diunduh lalu dibuka di Excel desktop → dikerjakan → tombol *Selesai*: macro menyimpan file, mengirimnya ke web, menutup workbook, dan menutup Excel bila tidak ada workbook lain yang terbuka.

### Prinsip
- **Penilaian tunggal:** macro hanya menyimpan file dan mengirimnya ke web (mis. HTTP POST dari VBA). Server menilai dengan aturan yang sama untuk jalur macro dan upload, jadi file yang sama selalu mendapat skor yang sama.
- **Kunci jawaban dihitung program, bukan AI:** AI hanya menulis cerita dan perintah soal; generator membuat data dan menghitung jawaban dari data itu. Skenario AI harus terikat ke template/skema data generator supaya cerita dan data cocok.
- **Penilaian metode, bukan hanya nilai:** periksa apakah sel jawaban berisi rumus (dan fungsi yang diminta), bukan angka yang diketik manual.
- **Level sebagai modul konten:** menambah Level 5–9 lewat `bmad-build` tidak boleh membongkar mesin Exam, penilaian, streak, atau UI peta level.
- **Waktu pembuatan skenario:** Level 1–4 dari bank soal yang dibuat saat build; Ujian Akhir dibuat saat runtime lewat Claude API (perlu API key, simpan di server, jangan di file Excel). Sumber skenario Level 5–9 belum diputuskan.

### Risiko teknis
- **Macro dari internet diblokir secara default.** Office memblokir macro di file yang diunduh dari internet (Mark of the Web). Mitigasi yang perlu dirancang: folder *Trusted Location* yang disetel sekali di laptop pribadi, atau langkah *Unblock* file. Jika tidak diizinkan di PC kantor, pakai jalur upload.
- **Menilai PivotTable** (termasuk yang sumber datanya file lain) secara otomatis: kemungkinan lewat pivot cache di file `.xlsx`/`.xlsm`, atau dengan menilai hasil Summary yang merujuk ke Pivot. Perlu riset sebelum Level 7–8 dan Ujian Akhir.
- **External links:** path file sumber berbeda antar-perangkat.

## Lingkungan & batasan versi
- Perangkat: laptop pribadi (utama) + PC kantor (sesekali). Progres, streak, dan rekor harus sinkron di keduanya, jadi web app perlu di-hosting dengan penyimpanan cloud, bukan hanya localhost.
- PC kantor kemungkinan punya kebijakan IT (blokir macro/instalasi), dan kelayakan jembatan Exam juga tergantung versi Excel. Jembatan Exam harus punya jalur cadangan yang tetap jalan di sana.
- Versi Excel: Office 2021 (laptop pribadi perlu dicek ulang).
  - Tersedia: XLOOKUP, XMATCH, FILTER, UNIQUE, SORT, SORTBY, SEQUENCE, LET, Power Query, Power Pivot / Data Model, PivotTable, external links.
  - Tidak tersedia (khusus Microsoft 365): LAMBDA, TEXTSPLIT, VSTACK/HSTACK, TAKE/DROP, GROUPBY/PIVOTBY. Kurikulum jangan memakai fungsi ini.

## Preferensi UI / UX
- Gaya visual: modern dan dinamis.
- Referensi: user biasa mencari template web dari v0.app. Pertimbangkan stack yang kompatibel dengan output v0 (React/Next.js + Tailwind + shadcn/ui) agar template bisa langsung dipakai.
