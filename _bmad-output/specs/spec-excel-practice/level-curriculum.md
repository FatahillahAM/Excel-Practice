# Kurikulum Level

Peta level, aturan kelulusan, dan batas fungsi Excel. Dirujuk oleh CAP-1, CAP-7, CAP-9, CAP-13, CAP-14, CAP-15, CAP-19.

## Peta level (disetujui 2026-10-22)

| Level | Nama | Isi | Kategori user | Jatah hint | Fase |
|---|---|---|---|---|---|
| 1 | Fondasi | Referensi `$`, Tabel Excel (Ctrl+T), Sort & Filter | dasar | 3 | V1 |
| 2 | Logika | IF, IFS, AND/OR, IFERROR | mengolah | 3 | V1 |
| 3 | Hitung bersyarat | COUNTIFS, SUMIFS, AVERAGEIFS, MAXIFS/MINIFS | mengolah | 3 | V1 |
| 4 | Cari data | VLOOKUP → XLOOKUP, INDEX-MATCH | mencari data | 3 | V1 |
| 5 | Rapikan data | TRIM, LEFT/MID/RIGHT, fungsi tanggal, Remove Duplicates, Power Query dasar | merapikan | 2 | Next |
| 6 | Rumus modern | FILTER, UNIQUE, SORT, LET | mengolah | 2 | Next |
| 7 | Pivot | PivotTable, PivotChart, Slicer | (ditambahkan) | 2 | Next |
| 8 | Lintas file | External links, Pivot / Power Query dari file lain | (ditambahkan) | 1 | Next |
| 9 | Summary | KPI, grafik, conditional formatting | (ditambahkan) | 1 | Next |
| 🏁 | Ujian Akhir | Gabungan semua: beberapa file data mentah → laporan multi-sheet + Summary + Pivot dari file lain | | 0 | Next |
| ➕ | Jalur sampingan | Co-authoring OneDrive (latihan + Tips, tidak dinilai otomatis) | | — | Next |

*Kategori user* memetakan level ke skill inti yang disebut user (mencari data, merapikan, mengolah). *(ditambahkan)* = di luar kategori itu, tetapi dibutuhkan Ujian Akhir. Di V1, level berfase Next tampil di peta dengan label *Under Construction*; jalur sampingan tampil sebagai satu node *Under Construction* di samping jalur utama; lulus Test Level 4 adalah akhir V1 ("Level 4 complete! Level 5 is coming soon"), tanpa level baru yang terbuka.

Skill mengelola file (external links, co-authoring) adalah materi latihan + Tips; co-authoring tidak masuk Ujian Akhir. Shared Workbook versi lama sudah dipensiunkan; co-authoring butuh OneDrive/SharePoint (kantor kemungkinan memakai OneDrive).

## Aturan per jenis percobaan

| | Latihan | Test level | Ujian Akhir |
|---|---|---|---|
| Fungsi | belajar | belajar + gerbang level | membuktikan |
| Skor minimum | — | ≥80/100 | ≥90/100 |
| Jumlah | 5 per level | 1 per level | — |
| Prasyarat | — | 5 latihan level itu selesai (skor berapa pun) | Test Level 9 lulus |
| Hint (dibuka di web, untuk soal yang dipilih) | jatah level, −5 poin per hint | jatah level, −5 poin per hint | tidak ada |
| Batas waktu | tidak ada (waktu dicatat) | tidak ada (waktu dicatat) | 60 menit; lewat batas → file otomatis dikirim, Excel ditutup, dinilai apa adanya |
| Kelulusan | — | cukup lulus 1 kali | 5 kali lolos berturut-turut; gagal sekali → hitungan 0 |
| Ulang | *Practice again* (data baru); tidak menambah hitungan 5 latihan | gagal → langsung ulang tanpa latihan tambahan; lulus → *Practice again* tanpa mengubah status level | — |
| Variasi | data baru tiap percobaan | data baru tiap percobaan | data **dan** skenario berbeda total tiap percobaan |

Waktu setiap percobaan (lulus maupun gagal, termasuk *Practice again*) ikut dihitung untuk rekor waktu dan streak; percobaan yang di-*Abandon* tidak.

**Bantuan menurun:** jatah hint 3 → 2 → 1 → 0 (lihat peta level), −5 poin per hint, jadi potongan hint maksimal 15 poin di Level 1–4. Tips tetap muncul di setiap soal. Yang dilatih adalah hafal langkah, bukan hafal jawaban.

## Isi Summary yang dinilai (Level 9 & Ujian Akhir)

- Perbandingan before vs after (mis. hasil kaizen)
- Total output vs target
- Top 5 (mis. mesin downtime terlama, proses kerja terlama)
- Grafik tren

## Batas fungsi: Office 2021

Perangkat: PC kantor Office 2021; laptop pribadi diduga Office 2021 (belum diverifikasi). Batas ini berlaku untuk kurikulum, perintah soal, hint, kartu Tips, dan kunci jawaban.

- **Boleh:** XLOOKUP, XMATCH, FILTER, UNIQUE, SORT, SORTBY, SEQUENCE, LET, Power Query, Power Pivot / Data Model, PivotTable, external links.
- **Dilarang (khusus Microsoft 365):** LAMBDA, TEXTSPLIT, VSTACK/HSTACK, TAKE/DROP, GROUPBY/PIVOTBY.
