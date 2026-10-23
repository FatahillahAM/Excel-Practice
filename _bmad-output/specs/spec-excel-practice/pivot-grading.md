# Penilaian PivotTable

Cara menilai PivotTable secara otomatis, termasuk yang bersumber dari file lain. Dirujuk oleh CAP-13 (Level 7–8) dan CAP-14. Status: **rekomendasi, belum diuji**. Wajib dibuktikan lewat spike dengan file buatan Office 2021 sebelum Level 7 dibangun.

## Referensi: cara pihak lain menilai

| Sumber | Cara menilai | Pelajaran untuk app ini |
|---|---|---|
| Microsoft Excel World Championship | Peserta mengetik jawaban (angka/teks) ke sel jawaban; dinilai otomatis dan objektif. Pivot hanya alat, tidak dinilai. | Penilaian lewat sel jawaban paling andal. |
| MOS Excel Expert (Certiport) | Dikerjakan di Excel asli; menurut panduan pihak ketiga, yang dinilai keadaan akhir workbook, bukan langkah yang ditempuh. Membuat & mengubah PivotTable termasuk objektif ujian. | Nilai hasil akhir di file, bukan cara klik. |
| SIMnet / MyLab IT Grader | File awal diunduh, dikerjakan di Office, lalu diupload untuk dinilai. Catatan rilis 2014: pivot dinilai lewat nama tabel/data referensi pivot dan filter slicer yang dipilih. | Struktur pivot bisa diperiksa dari file yang diupload. |
| Riset autograder (ASEE 2019, AIS SIGED 2018) | Membandingkan nilai, rumus, dan grafik dengan workbook acuan. Tidak ada studi khusus pivot. | Pivot = celah yang belum banyak dibahas; harus dibuktikan sendiri. |

## Isi file yang bisa dibaca server

Paket `.xlsx`/`.xlsm` menyimpan setiap PivotTable dalam beberapa bagian:

- **pivotTableDefinition:** field apa di area Rows, Columns, Values, Filters, beserta fungsi agregasinya dan lokasi pivot di sheet.
- **pivotCacheDefinition:** daftar field sumber dan **sumber datanya**: range di sheet (`worksheetSource`) atau koneksi eksternal (`cacheSource type="external"` + `connectionId`).
- **pivotCacheRecords:** salinan data sumber. Tidak ada untuk pivot berbasis Data Model/OLAP.
- **Sel worksheet:** salinan nilai yang tampil di pivot, tersimpan seperti sel biasa.

openpyxl bisa membaca bagian ini (`ws._pivots`, `pivot.cache`), tetapi tidak dirancang untuk membuat pivot. Parsing XML langsung juga bisa dipakai.

## Rekomendasi: penilaian berlapis

1. **Struktur:** pivot ada; field yang diminta berada di area yang benar; fungsi agregasi benar (mis. Sum, bukan Count); untuk Level 8, sumber data menunjuk ke file lain, bukan ke sheet yang sama.
2. **Hasil:** nilai yang tampil di sel pivot dibandingkan dengan kunci dari generator. Pivot yang belum di-*Refresh* setelah data berubah dinilai salah, dan memang kesalahan yang perlu dilatih.
3. **Summary:** sel Summary yang merujuk ke pivot (mis. GETPIVOTDATA) dinilai seperti soal rumus biasa: hasil + metode.

Keterangan per soal menyebut lapisan mana yang gagal (mis. "field Downtime ada di Rows, seharusnya di Values").

## Yang harus dibuktikan di spike

- Excel 2021 menyimpan lapisan 1–3 seperti di atas, untuk pivot dari range, Tabel, file lain, dan Power Query/Data Model.
- Cara sumber file lain tercatat (relationship ke workbook eksternal atau koneksi), dan bahwa nama file sumber bisa dibaca.
- Slicer dan PivotChart (Level 7) bisa dideteksi dari file.

## Sumber

- [Microsoft Excel World Championship — format](https://en.everybodywiki.com/Microsoft_Excel_World_Championship), [mewc.wiki.gg](https://mewc.wiki.gg/wiki/Events)
- [MO-211 exam structure (pihak ketiga)](https://open-exam-prep.com/study-guides/mo-211/mo-211-overview-fundamentals/exam-structure-strategy)
- [MyLab IT Grader](https://www.pearsonmylabandmastering.com/northamerica/myitlab/educators/badging/grader/index.html), [SIMnet release notes 2014](https://help.simnetonline.com/blog/2014-posts/simnet-project-release-notes-march-14-july-3)
- [ASEE: Automated Grading of Microsoft Excel Spreadsheets](https://peer.asee.org/automated-grading-of-microsoft-excel-spreadsheets), [AIS SIGED 2018](https://aisel.aisnet.org/siged2018/6)
- [Microsoft Learn: Working with PivotTables (Open XML)](https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/working-with-pivottables)
- [ECMA-376 cacheSource](https://webapp.docx4java.org/OnlineDemo/ecma376/SpreadsheetML/cacheSource.html), [worksheetSource](https://webapp.docx4java.org/OnlineDemo/ecma376/SpreadsheetML/worksheetSource.html)
- [openpyxl: Pivot Tables](https://openpyxl.readthedocs.io/en/stable/pivot.html)
