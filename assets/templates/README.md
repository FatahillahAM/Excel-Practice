# Template ujian `.xlsm`

Folder ini menyimpan template ujian per versi (`exam.v<N>.xlsm`, spine AD-4) dan sumber VBA-nya di `vba/` untuk direview. Server tidak pernah membuat workbook dari nol: ia membuka template, mengisi sel dan custom property, lalu menutupnya lagi tanpa menyentuh tombol atau VBA.

Panduan di bawah membuat `exam.v1.xlsm` untuk spike S1. Ikuti persis: patcher mengandalkan nama sheet, alamat sel, dan nama property ini. Bila layout final nanti berbeda, itu menjadi template baru `exam.v2.xlsm`, bukan perubahan pada v1.

## Layout v1

| Sheet | Sel | Isi (ditulis server) |
|---|---|---|
| `Instructions` | B2 | Judul |
| `Instructions` | B4 | Skenario |
| `Instructions` | B6:B10 | Lima perintah soal |
| `Instructions` | D2 | Tombol **Finish** (bukan sel; tombol diletakkan di atas D2) |
| `Data` | mulai A1 | Data soal |

Semua sel di atas **dibiarkan kosong** di template. Jangan mengetik teks contoh, rumus, atau apa pun di sel lain.

## Membuat `exam.v1.xlsm` di Excel 2021

### 1. Siapkan Excel

1. Tampilkan tab **Developer** bila belum ada: **File → Options → Customize Ribbon**, centang **Developer** di kolom kanan, **OK**.
2. Unduh `assets/templates/vba/modFinish.bas` dari GitHub (buka filenya, tombol **Download raw file**). Jangan menyalin isinya lewat copy-paste: file harus diimpor apa adanya.

### 2. Workbook dan sheet

1. **File → New → Blank workbook**.
2. Klik kanan tab `Sheet1` → **Rename** → `Instructions`.
3. Klik **+** di sebelah tab untuk menambah sheet, lalu rename menjadi `Data`. Urutan tab: `Instructions`, lalu `Data`. Tidak ada sheet lain.
4. Sheet `Data` dibiarkan kosong sama sekali.

### 3. Format sheet `Instructions`

Format hanya sel yang disebut, jangan seluruh kolom atau baris (pilih sel, bukan huruf kolom).

1. Klik kanan header kolom **B** → **Column Width** → `80` → **OK**. (Lebar kolom boleh; yang dilarang hanya memberi format sel ke seluruh kolom.)
2. Pilih **B2** → **Home → Bold**, ukuran font `14`.
3. Pilih **B4**, lalu tahan Ctrl dan pilih **B6:B10** → **Home → Wrap Text**.
4. Biarkan semua sel kosong.

### 4. Impor modul VBA

1. Tekan **Alt+F11** (Visual Basic Editor).
2. Di panel **Project**, pilih `VBAProject (Book1)` (nama workbook yang sedang dibuat).
3. **File → Import File…** → pilih `modFinish.bas` → **Open**. Modul `modFinish` muncul di folder **Modules**.
4. Jangan memberi password pada VBA project (**Tools → VBAProject Properties → Protection** dibiarkan kosong).
5. Tutup Visual Basic Editor.

### 5. Tombol Finish

1. **Developer → Insert → Form Controls → Button (Form Control)** (ikon pertama di baris Form Controls, bukan ActiveX Controls).
2. Gambar tombol di atas sel **D2**.
3. Di dialog **Assign Macro**, pilih `Finish` → **OK**.
4. Klik kanan tombol → **Edit Text** → ganti teks menjadi `Finish`, lalu klik sel lain.

### 6. Tiga custom property

1. **File → Info → Properties** (di kanan) **→ Advanced Properties → Custom**.
2. Tambahkan tiga property berikut satu per satu. Untuk tiap property: isi **Name**, pilih **Type** `Text`, isi **Value** `TEMPLATE`, klik **Add**.

   | Name | Type | Value |
   |---|---|---|
   | `WHE_AttemptToken` | Text | `TEMPLATE` |
   | `WHE_ServerUrl` | Text | `TEMPLATE` |
   | `WHE_TemplateVersion` | Text | `TEMPLATE` |

3. Pastikan ketiganya tampil di daftar **Properties** bagian bawah dengan Type `Text`, lalu **OK**.

### 7. Uji cepat sebelum menyimpan

Klik tombol **Finish**. MsgBox harus menampilkan:

```
WHE_AttemptToken: TEMPLATE
WHE_ServerUrl: TEMPLATE
WHE_TemplateVersion: TEMPLATE
```

Bila ada baris `(missing)`, nama property di langkah 6 salah ketik.

### 8. Simpan

1. Klik sel **A1** di sheet `Instructions` agar sheet itu yang aktif saat file dibuka.
2. **File → Save As → Browse**, **Save as type** `Excel Macro-Enabled Workbook (*.xlsm)`, nama file `exam.v1.xlsm` → **Save**.
3. Tutup Excel.

## Mengirim template ke repo

1. Buka repo `FatahillahAM/Excel-Practice` di GitHub, pilih branch `claude/laughing-shannon-vnoryl`, lalu masuk ke folder `assets/templates/`.
2. **Add file → Upload files**, seret `exam.v1.xlsm`.
3. Pilih **Commit directly to the `claude/laughing-shannon-vnoryl` branch** → **Commit changes**.
4. Beri tahu agent. Agent menjalankan `git pull`, mencatat hash `vbaProject.bin` di `src/adapters/workbook/templates.ts`, lalu menjalankan `node scripts/spike-s1.ts` dan mengirim file hasil patch beserta token yang dicetak.

## Menguji file hasil patch di laptop (spike S1)

1. Simpan file yang dikirim agent (`spike-s1-….xlsm`) ke folder Trusted Location, atau klik kanan file → **Properties → General**, centang **Unblock** → **OK**. Tanpa ini, Windows memblokir macro dari file unduhan.
2. Buka file di Excel 2021, lalu catat:
   - Apakah muncul dialog perbaikan ("We found a problem with some content…")? Bila ya, salin teks dialog dan isi daftar perbaikannya.
   - Sheet `Instructions`: judul di B2, skenario dua baris di B4 dengan tanda `&`, `<`, dan `"` tampil apa adanya, lima soal di B6:B10.
   - Sheet `Data`: tabel mulai A1; kolom angka rata kanan (angka, bukan teks).
3. Bila ada bar **Enable Content**, klik. Klik **Finish**. MsgBox menampilkan tiga property; `WHE_AttemptToken` harus sama dengan token yang dicetak agent. Tekan **Ctrl+C** saat MsgBox terbuka untuk menyalin isinya, lalu tempel ke chat.
4. Tutup tanpa menyimpan.
