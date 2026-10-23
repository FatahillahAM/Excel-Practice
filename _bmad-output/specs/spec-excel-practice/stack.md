# Stack & Lingkungan

Batasan lingkungan dan konteks teknis. Batasan ada di Constraints SPEC.md; keputusan stack dan arsitektur yang mengikat ada di `ARCHITECTURE-SPINE.md`.

## Perangkat

- Laptop pribadi (utama) + PC kantor (sesekali) untuk mengerjakan soal; HP hanya untuk cek progres/streak dan memasang freeze. Satu pengguna.
- PC kantor kemungkinan punya kebijakan IT yang memblokir macro dan instalasi; kelayakan jembatan Exam juga tergantung versi Excel, jadi jalur upload wajib tetap jalan di sana.

## Hosting

- Diputuskan (spine): Next.js 16 di Vercel + Supabase (Postgres, Auth Google, Storage), mulai dari starter `with-supabase`; Production ↔ Supabase `prod`, Preview/lokal ↔ `dev`.
- Kunci Claude API hanya di server (dibutuhkan mulai Ujian Akhir; V1 tidak memanggil AI saat runtime).
- Server menerima file dari macro VBA (mis. HTTP POST) dan dari upload web.
- Login: *Sign in with Google* dengan allowlist satu akun; sesi ±30 hari per perangkat (CAP-17).

## Preferensi UI

- Diputuskan di UX run: shadcn/ui di Next.js + Tailwind, tema "Dark Excel" (gelap default, toggle terang), animasi scroll 3D di Level Map dan Results — `DESIGN.md`, `EXPERIENCE.md`.
- User biasa mengambil template web dari v0.app; stack ini kompatibel dengan output v0.
- Animasi 3D: CSS 3D + scroll-driven animations saja, tanpa library 3D atau video, dengan frame statis (spine AD-12).

## Cara membangun

- Sepenuhnya dengan Claude Code (user punya sedikit pengalaman coding).
- V1 ditargetkan selesai dalam satu build yang langsung bisa dipakai; tanpa tanggal tetap.
- Level 5–9 dan Ujian Akhir ditambahkan lewat `bmad-build` di build berikutnya.
