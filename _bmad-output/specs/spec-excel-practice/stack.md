# Stack & Lingkungan

Batasan lingkungan dan preferensi teknis. Preferensi bukan keharusan; batasan ada di Constraints SPEC.md.

## Perangkat

- Laptop pribadi (utama) + PC kantor (sesekali), satu pengguna.
- PC kantor kemungkinan punya kebijakan IT yang memblokir macro dan instalasi; kelayakan jembatan Exam juga tergantung versi Excel, jadi jalur upload wajib tetap jalan di sana.

## Hosting

- Web app di-hosting dengan penyimpanan cloud agar progres, streak, dan rekor sinkron di dua perangkat.
- Kunci Claude API hanya di server (dibutuhkan mulai Ujian Akhir; V1 tidak memanggil AI saat runtime).
- Server menerima file dari macro VBA (mis. HTTP POST) dan dari upload web.

## Preferensi UI

- Gaya visual: modern dan dinamis.
- User biasa mengambil template web dari v0.app. Pertimbangkan stack yang kompatibel dengan output v0 (React/Next.js + Tailwind + shadcn/ui) agar template bisa langsung dipakai.

## Cara membangun

- Sepenuhnya dengan Claude Code (user punya sedikit pengalaman coding).
- V1 ditargetkan selesai dalam satu build yang langsung bisa dipakai; tanpa tanggal tetap.
- Level 5–9 dan Ujian Akhir ditambahkan lewat `bmad-build` di build berikutnya.
