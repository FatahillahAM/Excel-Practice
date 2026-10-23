# Pembuatan Soal

Siapa membuat apa dalam setiap soal, dan kapan. Dirujuk oleh CAP-6, CAP-13, CAP-14.

## Pembagian kerja

| Bagian soal | Dibuat oleh | Catatan |
|---|---|---|
| Cerita & perintah soal | AI | Bernuansa pekerjaan user; wajib terikat ke template/skema data generator agar cerita dan data cocok. |
| Data | Generator (program) | Diacak tiap percobaan. |
| Kunci jawaban | Generator (program) | Dihitung dari data percobaan itu; skor tidak pernah bergantung pada hitungan AI. |

## Kapan skenario dibuat

| Cakupan | Sumber skenario | Fase |
|---|---|---|
| Level 1–4 | Bank skenario, dibuat saat build; minimal 10 skenario per level (5 latihan + 1 Test per level) | V1 |
| Level 5–9 | AI, runtime via Claude API (seperti Ujian Akhir) | Next |
| Ujian Akhir | Runtime via Claude API, agar 5 percobaan berturut-turut berbeda total | Next |

Runtime via Claude API butuh API key (disimpan di server) dan biaya kecil per ujian.

## Domain data

Produksi, maintenance, kaizen (improvement), time study, kapasitas gudang (warehouse / finished goods). Tidak ada data generik (penjualan toko, nilai siswa).

## Risiko

- **Skenario tidak masuk akal atau tidak cocok dengan data** → diredam oleh keterikatan skenario ke skema generator.
- **Bank Level 1–4 terasa berulang** bila terlalu kecil. Angka data tetap diacak; minimal 10 skenario per level.
