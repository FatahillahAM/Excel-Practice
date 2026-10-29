# Fixture workbook `.xlsm`

Folder ini menyimpan file `.xlsm` yang disimpan oleh Excel sungguhan, dipakai tes pembaca workbook (`read.test.ts`) dan `scripts/spike-s2.ts`. File di sini tidak pernah dibuat atau diubah oleh kode.

## `s2-excel2021.xlsm` (spike S2)

Spike S2 membuktikan bahwa server membaca teks rumus (termasuk rumus hasil fill down) dan nilai yang dihitung Excel dari file yang disimpan Excel 2021. Ikuti persis: tes membandingkan setiap sel dengan tabel di bawah, jadi rumus, alamat sel, dan cara mengisinya (diketik atau fill down) harus sama.

### 1. Buka file S1

1. Pakai file uji S1 yang sudah ada di laptop (`spike-s1-XD3PPwFf.xlsm`, ditutup tanpa disimpan), atau minta agent membuat file baru dengan `node scripts/spike-s1.ts`. Sheet `Data` harus berisi tabel produksi A1:G11 dari S1 dan belum diubah.
2. Buka di Excel 2021. Bila muncul bar kuning **Protected View**, klik **Enable Editing**. Macro tidak perlu dijalankan; bar **Enable Content** boleh diabaikan.

### 2. Pemisah argumen

Rumus di bawah memakai koma (`,`) sebagai pemisah argumen. Bila Excel menolak rumus dengan pesan "There's a problem with this formula", Windows memakai pengaturan regional dengan titik koma: ganti setiap `,` dengan `;` lalu ketik ulang. Excel tetap menyimpan rumusnya dengan koma di dalam file, jadi hasil tes sama. Dengan pengaturan regional yang sama, Excel bisa menampilkan desimal dengan koma (`1250,5`, `0,022999`); itu nilai yang sama dengan tabel di bawah.

### 3. Sheet `Instructions`: ketik C6:C10

Klik tiap sel, ketik isinya persis, tekan **Enter**.

| Sel | Ketik | Excel menampilkan |
|---|---|---|
| C6 | `=SUMIFS(Data!E2:E11,Data!B2:B11,"Lini A")` | 4125 |
| C7 | `=SUMIFS(Data!F2:F11,Data!C2:C11,"Malam")` | 226 |
| C8 | `=AVERAGEIFS(Data!G2:G11,Data!D2:D11,"Baut M8")` | 1250.5 |
| C9 | `=SUM(Data!F2:F11/SUM(Data!E2:E11))` | 0.022999 (atau mirip, tergantung lebar kolom) |
| C10 | `226` (angka biasa, **tanpa** `=`) | 226 |

### 4. Sheet `Data`: kolom H, I, J dengan fill down

Untuk tiap kolom: ketik rumus di baris 2 saja, lalu salin ke bawah dengan fill down. **Jangan** mengetik baris 3–11 satu per satu; spike ini menguji rumus yang disimpan Excel dari fill down.

| Kolom | Ketik di baris 2 | Fill down sampai |
|---|---|---|
| H | `=F2/E2` di H2 | H11 |
| I | `=IF(H2>3%,"Periksa","OK")` di I2 | I11 |
| J | `=E2/SUM($E$2:$E$11)` di J2 | J11 |

Cara fill down untuk kolom H (ulangi untuk I dan J):

1. Klik **H2**, ketik rumusnya, tekan **Enter**.
2. Klik **H2**, tahan **Shift**, klik **H11** (H2:H11 terpilih).
3. Tekan **Ctrl+D**.

Hasil yang harus tampil:

- Kolom H: angka kecil (cacat ÷ produksi), misalnya H2 0.015.
- Kolom I: `Periksa` di baris 3, 7, dan 9; `OK` di baris lainnya.
- Kolom J: angka kecil yang jumlahnya 1, misalnya J2 0.090192.

### 5. Sheet `Data`: ketik L2:L6

Klik tiap sel, ketik isinya persis, tekan **Enter**. Biarkan **L7 dan L8 kosong**: rumus di L6 mengisi L6:L8 sendiri (spill).

| Sel | Ketik | Excel menampilkan |
|---|---|---|
| L2 | `=XLOOKUP("B-2610-05",A2:A11,F2:F11)` | 35 |
| L3 | `=INDEX(F2:F11,MATCH("B-2610-08",A2:A11,0))` | 31 |
| L4 | `=IFS(L2>30,"besar",TRUE,"kecil")` | besar |
| L5 | `=IFERROR(VLOOKUP("X",A2:F11,6,FALSE),"tidak ada")` | tidak ada |
| L6 | `=UNIQUE(B2:B11)` | Lini A, lalu Lini B di L7 dan Lini C di L8 |

Bila L6 menampilkan `#SPILL!`, L7 atau L8 tidak kosong: hapus isinya.

### 6. Jangan mengubah yang lain

- Jangan mengetik judul kolom (H1, I1, J1, L1 tetap kosong) atau isi di sel lain.
- Jangan mengubah data A1:G11, mengurutkan, memfilter, atau menyisipkan baris dan kolom.
- Format angka tidak perlu diubah; tes membaca nilai, bukan tampilan.

### 7. Simpan

1. Pastikan **Formulas → Calculation Options** bernilai **Automatic** (bawaan). Bila **Manual**, tekan **F9** sebelum menyimpan.
2. **File → Save As → Browse**, **Save as type** `Excel Macro-Enabled Workbook (*.xlsm)`, nama file `s2-excel2021.xlsm` → **Save**.
3. Tutup Excel.

### 8. Kirim ke repo

1. Buka repo `FatahillahAM/Excel-Practice` di GitHub, pilih branch kerja yang sedang dipakai untuk spike ini (bukan `main`), lalu masuk ke folder `src/adapters/workbook/__fixtures__/`.
2. **Add file → Upload files**, seret `s2-excel2021.xlsm`.
3. Pilih **Commit directly to the … branch** untuk branch kerja itu (bukan `main`) → **Commit changes**.
4. Beri tahu agent. Agent menjalankan `git pull`, `node scripts/spike-s2.ts` (mencetak tiap sel, cocok atau tidak, dan apakah hash `modFinish` file simpanan sama dengan hash era S1), lalu mencocokkan hasilnya dengan pembacaan openpyxl.
