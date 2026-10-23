# Jembatan Exam

Bagaimana web dan Excel desktop terhubung untuk latihan, Test, dan Ujian Akhir. Dirujuk oleh CAP-2, CAP-3, CAP-4, CAP-5, CAP-7, CAP-16, CAP-17, CAP-18.

Browser tidak bisa membuka Excel desktop lalu mendeteksi saat Excel ditutup, jadi dibutuhkan jembatan.

## Opsi yang dipertimbangkan

| Opsi | Status | Alasan |
|---|---|---|
| A. Aplikasi pendamping lokal (buka Excel, deteksi tutup, nilai, kirim) | Ditolak | Paling mirip impian awal (Excel tertutup otomatis), tetapi butuh instalasi; berisiko di PC kantor. |
| B. File `.xlsm` + tombol *Selesai* (macro) | **Jalur utama** | Tanpa instalasi; tombol membuat titik akhir timer jelas dan adil. |
| C. Unduh lalu upload manual | **Cadangan** | Jalan di mana saja, termasuk saat macro diblokir. |
| D. Office Add-in (panel web di dalam Excel) | Tidak dilanjutkan | Disebut di awal diskusi, tidak masuk pilihan akhir. |

## Alur

```mermaid
sequenceDiagram
    actor U as User
    participant W as Web (server)
    participant X as Excel desktop
    U->>W: Mulai (latihan / Test)
    W->>W: generator buat data + kunci; ambil skenario; catat waktu mulai; sematkan identitas percobaan
    W-->>U: unduh file soal .xlsm
    U->>X: buka & kerjakan
    opt butuh bantuan
        U->>W: buka hint di web (−5 poin, dalam jatah level, dicatat untuk percobaan ini)
    end
    alt Jalur B — macro aktif
        U->>X: tombol Selesai
        X->>X: simpan file
        X->>W: kirim file (mis. HTTP POST dari VBA)
        X->>X: tutup workbook; tutup Excel bila tak ada workbook lain
    else Jalur C — macro diblokir/gagal
        U->>X: simpan
        U->>W: upload file lewat web
    end
    W->>W: verifikasi kepemilikan & percobaan; tolak bila tidak cocok
    W->>W: nilai (aturan sama untuk B & C)
    W-->>U: skor, waktu, keterangan per soal, kartu Tips
```

## Prinsip penilaian

- **Penilaian tunggal:** macro hanya menyimpan dan mengirim file. Server menilai dengan aturan yang sama untuk jalur B dan C, jadi file yang sama selalu mendapat skor yang sama.
- **Kunci dari program:** dibandingkan terhadap kunci yang dihitung generator dari data percobaan itu (lihat `content-generation.md`).
- **Metode, bukan hanya nilai:** periksa bahwa sel jawaban berisi rumus dan memakai fungsi yang diminta, bukan angka yang diketik manual.
- **Keterangan per soal:** benar/salah dan alasannya.

## Verifikasi kepemilikan (CAP-17, CAP-18)

- Web hanya untuk satu akun yang sudah login; tidak ada pendaftaran.
- Setiap kiriman, lewat macro maupun upload, harus terbukti berasal dari percobaan aktif milik user; yang tidak cocok ditolak dengan alasan dan tidak dinilai.
- Kandidat cara (bukan keharusan): token unik per percobaan disematkan di file saat *Mulai*; server mencocokkan token dengan percobaan aktif, lalu menandai percobaan selesai agar file yang sama tidak dinilai dua kali. Macro tidak menyimpan password atau kunci API.

## Risiko teknis

- **Macro dari internet diblokir default (Mark of the Web).** Mitigasi: web menyediakan panduan penyiapan sekali jalan (CAP-16) berisi folder *Trusted Location* di laptop pribadi dan langkah *Unblock* file. Bila PC kantor tidak mengizinkan, pakai jalur C.
- **Menilai PivotTable otomatis** (termasuk sumber file lain): rekomendasi berlapis dan referensinya di `pivot-grading.md`; wajib di-spike sebelum Level 7.

## File sumber & external link (Level 8, Ujian Akhir)

- Semua file satu percobaan dikerjakan di satu folder kerja lokal di perangkat user.
- Excel menyimpan workbook link relatif terhadap workbook tujuan bila memungkinkan ([Microsoft KB 328440](https://support.microsoft.com/en-us/kb/328440)), jadi link tetap jalan di laptop maupun PC kantor selama posisi relatif file sama.
- Usulan: folder kerja satu nama tetap yang sekaligus dijadikan *Trusted Location* lewat panduan CAP-16.
- Server hanya menerima workbook utama; penilaian link memeriksa nama file sumber yang dirujuk.

## Batas waktu Ujian Akhir (CAP-14)

- Menit ke-60 lewat jalur macro: file otomatis disimpan dan dikirim, workbook ditutup (Excel ikut ditutup bila tidak ada workbook lain), percobaan dinyatakan selesai lalu dinilai apa adanya.
- Lewat jalur upload: server menutup percobaan di menit ke-60; upload sesudahnya ditolak dan percobaan dihitung tidak lolos.
