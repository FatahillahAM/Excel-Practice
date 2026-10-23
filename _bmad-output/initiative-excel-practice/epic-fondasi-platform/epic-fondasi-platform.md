---
type: epic
title: "Fondasi platform dan bukti jembatan Excel"
parent: initiative-excel-practice
covers: [CAP-17]
after: []
assignee: ""
risk: high
---

# Fondasi platform dan bukti jembatan Excel

## Description

Platform dasar berjalan di Production (Vercel + Supabase, Preview ↔ dev, CI), hanya akun Google El Zavier yang bisa masuk, dan tiga bagian paling berisiko dari jembatan Excel sudah terbukti di laptop: template yang di-patch tetap utuh, rumus terbaca, dan Finish bisa mengirim file.

## Outcome

Epic berikutnya bisa membangun Start, Finish, dan penilaian di atas fondasi yang sudah terbukti; sinyalnya adalah satu file dari Production yang kembali ke Production lewat Finish dan terbaca server.

## Requirements

- CAP-17: Hanya akun Google user yang masuk; tanpa pendaftaran dan password; sesi ±30 hari per perangkat. (SPEC, CAP-17)
- B1: App Next.js dari starter `with-supabase` berjalan di Vercel Production dan terhubung ke Supabase `prod`. (spine, Stack; AD-13)
- B2: Preview dan lokal memakai Supabase `dev`; skema hanya berubah lewat migrasi SQL di repo. (spine, AD-13)
- B3: CI menjalankan lint (termasuk larangan impor di `src/core`), typecheck, dan Vitest. (spine, AD-1; Consistency Conventions › Testing)
- B4: App shell — token Dark Excel, App Sidebar, Mobile Drawer, Header Bar, Theme Toggle, preferensi tema dan motion per perangkat. (DESIGN.md, Components; spine, Conventions › Preferences; AD-12)
- S1: Template `exam.v1.xlsm` yang di-patch tetap terbuka utuh di Excel 2021 dengan tombol Finish dan VBA. (spine, Required Spikes)
- S2: Teks rumus (termasuk shared formula) dan nilai cache terbaca benar dari file simpanan Excel 2021. (spine, Required Spikes)
- S3: Finish mengirim file ke `WHE_ServerUrl` lewat HTTPS dari laptop dan melaporkan status. (spine, Required Spikes)

## Done when

1. Di Production, akun Google El Zavier masuk ke app; akun Google lain ditolak tanpa sesi.
2. Deploy Preview membaca Supabase `dev`; daftar migrasi sama di `dev` dan `prod`.
3. CI hijau untuk push bersih dan merah untuk push yang mengimpor `next` atau `@supabase/*` dari `src/core`.
4. Hasil spike S1, S2, S3 tercatat sebagai `Decision:` di Notes epic ini, termasuk pustaka WorkbookIO yang dipilih atau fallback Python.
5. Di laptop dengan Excel 2021, file yang diunduh dari Production terbuka dengan tombol Finish, Finish mengirimnya ke Production, dan server membaca token serta satu teks rumus dari file itu.
6. Setelah login, shell (sidebar, header, toggle tema) tampil sesuai DESIGN.md dalam mode gelap dan terang, dan pilihan tema bertahan setelah reload.

## Boundaries

Platform baseline + bukti jembatan Excel. Bukan: siklus percobaan, Start/Finish untuk percobaan nyata, penilaian, konten level, dan layar selain shell dan Login (epic 2–5).

## References

- parent — _bmad-output/initiative-excel-practice/initiative-excel-practice.md
- spec — _bmad-output/specs/spec-excel-practice/SPEC.md, CAP-17 dan Constraints
- architecture — _bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md, sections AD-1, AD-4, AD-9, AD-12, AD-13, Stack, Required Spikes
- design — _bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/DESIGN.md, sections Colors, Components (App Sidebar, Header Bar, Theme Toggle, Login Card)
- design — _bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md, sections Component Patterns (Login Card, App Sidebar, Mobile Drawer, Theme Toggle) dan State Patterns › Login
- bridge — _bmad-output/specs/spec-excel-practice/exam-bridge.md, sections Alur dan Verifikasi kepemilikan

## Notes

- Decision: tracer bullet = entry 1 (scaffold ter-deploy ke Production); entry 2–4 (spike) dan 5–8 (platform) adalah dua jalur paralel; entry 9 menyatukannya (2026-10-23).
- Decision: Refactor sweep (entry 10) dipakai di akhir epic (user, 2026-10-23).
- Decision: bila S1 atau S2 gagal, fallback adapter WorkbookIO Python/openpyxl lewat Vercel Services; spine diperbarui lewat `bmad-architecture` (2026-10-23).
- Unknown: apakah Supabase Before User Created hook berjalan untuk sign-up Google OAuth; entry 7 membuktikannya, cek `ALLOWED_EMAIL` di callback tetap wajib.
- Unknown: apakah PC kantor mengizinkan Excel mengirim lewat HTTPS; S3 hanya menguji laptop, PC kantor diuji di epic 2 (upload tetap jalur cadangan).
