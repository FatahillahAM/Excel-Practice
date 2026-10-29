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

Klik tombol **Finish**. Karena property masih `TEMPLATE`, MsgBox **Finish** harus menampilkan:

```
File ini tidak berisi data ujian yang lengkap.

Unduh ulang file ujian dari aplikasi.
```

Pesan ini membuktikan tombol sudah terhubung ke macro. Bila muncul pesan lain (misalnya "Cannot run the macro"), ulangi langkah 5.

### 8. Simpan

1. Klik sel **A1** di sheet `Instructions` agar sheet itu yang aktif saat file dibuka.
2. **File → Save As → Browse**, **Save as type** `Excel Macro-Enabled Workbook (*.xlsm)`, nama file `exam.v1.xlsm` → **Save**.
3. Tutup Excel.

## Mengirim template ke repo

1. Buka repo `FatahillahAM/Excel-Practice` di GitHub, pilih branch kerja yang sedang dipakai untuk pekerjaan template ini (bukan `main`), lalu masuk ke folder `assets/templates/`.
2. **Add file → Upload files**, seret `exam.v1.xlsm`.
3. Pilih **Commit directly to the … branch** untuk branch kerja itu (bukan `main`) → **Commit changes**.
4. Beri tahu agent. Agent menjalankan `git pull`, lalu `node scripts/spike-s1.ts --template <file>` dan menyalin baris `registry entry:` (sidik jari VBA: hash per modul yang tidak kosong, dihitung adapter) ke `src/adapters/workbook/templates.ts`, lalu menjalankan `node scripts/spike-s1.ts` tanpa `--template` dan mengirim file hasil patch beserta token yang dicetak.

## Menguji file hasil patch di laptop (spike S1)

Langkah ini untuk `modFinish` versi S1, yang hanya menampilkan tiga property. Sejak spike S3, **Finish** mengirim file ke server: ikuti [Menguji Finish di laptop (spike S3)](#menguji-finish-di-laptop-spike-s3).

1. Simpan file yang dikirim agent (`spike-s1-….xlsm`) ke folder Trusted Location, atau klik kanan file → **Properties → General**, centang **Unblock** → **OK**. Tanpa ini, Windows memblokir macro dari file unduhan.
2. Buka file di Excel 2021, lalu catat:
   - Apakah muncul dialog perbaikan ("We found a problem with some content…")? Bila ya, salin teks dialog dan isi daftar perbaikannya.
   - Sheet `Instructions`: judul di B2, skenario dua baris di B4 dengan tanda `&`, `<`, dan `"` tampil apa adanya, lima soal di B6:B10.
   - Sheet `Data`: tabel mulai A1; kolom angka rata kanan (angka, bukan teks).
3. Bila ada bar **Enable Content**, klik. Klik **Finish**. MsgBox menampilkan tiga property; `WHE_AttemptToken` harus sama dengan token yang dicetak agent. Tekan **Ctrl+C** saat MsgBox terbuka untuk menyalin isinya, lalu tempel ke chat.
4. Tutup tanpa menyimpan.

## Mengganti `modFinish` di `exam.v1.xlsm` (spike S3)

Spike S3 mengganti isi `modFinish`: tombol **Finish** kini menyimpan salinan workbook ke folder TEMP, mengirimnya ke `WHE_ServerUrl` lewat HTTPS, lalu menampilkan hasilnya. Versi template tetap v1 (v1 belum dirilis), jadi file `exam.v1.xlsm` yang sama diubah di tempat. Selain modul, tidak ada yang diubah: sheet, sel, tombol, dan custom property dibiarkan.

### 1. Siapkan file

1. Unduh `assets/templates/exam.v1.xlsm` dan `assets/templates/vba/modFinish.bas` dari branch kerja spike ini di GitHub (buka filenya, tombol **Download raw file**). Jangan menyalin isi `.bas` lewat copy-paste.
2. Klik kanan `exam.v1.xlsm` → **Properties → General**, centang **Unblock** → **OK** (atau simpan di Trusted Location).
3. Buka `exam.v1.xlsm` di Excel 2021. Bila ada bar **Enable Content**, klik.

### 2. Ganti modul

1. Tekan **Alt+F11** (Visual Basic Editor).
2. Di panel **Project**, buka folder **Modules** di bawah `VBAProject (exam.v1.xlsm)`, klik kanan `modFinish` → **Remove modFinish…**. Pertanyaan "export before removing?" dijawab **No**.
3. Pilih `VBAProject (exam.v1.xlsm)`, lalu **File → Import File…** → pilih `modFinish.bas` yang baru diunduh → **Open**. Modul `modFinish` muncul lagi di folder **Modules**.
4. **Debug → Compile VBAProject**. Tidak boleh muncul pesan error. Bila muncul, salin teksnya ke chat dan berhenti di sini.
5. Jangan mengetik apa pun di jendela kode dan jangan memberi password pada VBA project. Tutup Visual Basic Editor.

### 3. Periksa tombol dan property

1. Klik kanan tombol **Finish** → **Assign Macro**. `Finish` harus terpilih; bila tidak, pilih `Finish` → **OK**. Klik sel lain.
2. Klik tombol **Finish**. MsgBox harus menampilkan "File ini tidak berisi data ujian yang lengkap." (property masih `TEMPLATE`, jadi tidak ada yang dikirim).
3. **File → Info → Properties → Advanced Properties → Custom**: tiga property `WHE_*` masih ada dengan nilai `TEMPLATE`. Tutup dialog tanpa mengubah apa pun.

### 4. Simpan dan kirim

1. Klik sel **A1** di sheet `Instructions`.
2. **Ctrl+S** (tetap `exam.v1.xlsm`, format `.xlsm`). Tutup Excel.
3. Unggah `exam.v1.xlsm` ke `assets/templates/` di branch kerja yang sama, seperti di [Mengirim template ke repo](#mengirim-template-ke-repo), lalu beri tahu agent. Agent menghitung ulang sidik jari registry v1, membuka PR ke `main`, dan setelah PR di-merge mengirim file uji dari `node scripts/spike-s1.ts` beserta token dan `tokenSha256`-nya.

## Menguji Finish di laptop (spike S3)

Mulai setelah agent memberi tahu bahwa endpoint sudah ada di Production dan mengirim file `spike-s1-….xlsm`.

### 1. Siapkan file

1. Simpan file ke folder Trusted Location, atau klik kanan file → **Properties → General**, centang **Unblock** → **OK**.
2. Buka di Excel 2021. Bila ada bar **Enable Content**, klik.

### 2. Kirim online

1. Pastikan laptop terhubung ke internet.
2. Klik **Finish**. MsgBox harus menampilkan "Terkirim. Server menerima file ini." dan "Ukuran file: … byte".
3. Tekan **Ctrl+C** saat MsgBox terbuka, tempel ke chat, lalu **OK**. Agent mencocokkan ukuran dan `tokenSha256` dengan log Production.

Bila MsgBox menampilkan "Server menolak file ini.", salin juga isinya (berisi **Kode**). Bila menampilkan "Gagal …", salin teks **Detail**-nya.

### 3. Tambah sheet dan buka VBA editor, lalu kirim lagi

1. Klik **+** di sebelah tab sheet untuk menambah sheet baru (biarkan namanya).
2. Tekan **Alt+F11**, klik dua kali `modFinish` agar kodenya tampil, jangan mengetik apa pun, lalu tutup Visual Basic Editor.
3. Kembali ke sheet `Instructions`, klik **Finish**. MsgBox harus menampilkan "Terkirim." lagi. Salin dengan **Ctrl+C** dan tempel ke chat.
4. **File → Save As → Browse**, **Save as type** `Excel Macro-Enabled Workbook (*.xlsm)`, nama file `s3-excel2021.xlsm` → **Save**. File ini menjadi fixture salinan simpanan Excel untuk registry v1.

### 4. Kirim tanpa jaringan

1. Matikan Wi-Fi (atau nyalakan Airplane mode) dan cabut kabel LAN bila ada.
2. Klik **Finish**. MsgBox harus menampilkan "Gagal mengirim file ke server." dan workbook tetap terbuka. Salin isinya ke chat, lalu **OK**.
3. Ketik `%TEMP%` di address bar File Explorer: tidak boleh ada file `whe-finish-….xlsm` yang tertinggal.
4. Nyalakan lagi jaringan. Tutup Excel **tanpa** menyimpan (file `s3-excel2021.xlsm` sudah tersimpan di langkah 3).

### 5. Kirim fixture

Unggah `s3-excel2021.xlsm` ke `src/adapters/workbook/__fixtures__/` di branch kerja spike ini (**Add file → Upload files**, **Commit directly to the … branch**, bukan `main`), lalu beri tahu agent.
