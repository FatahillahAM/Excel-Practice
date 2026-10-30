---
type: epic
title: "Fondasi platform dan bukti jembatan Excel"
parent: initiative-excel-practice
covers: [CAP-17]
after: []
assignee: ""
risk: high
status: in-progress
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
- Decision: versi seed dari entry 1, dipin di `package.json`: Next.js 16.4.2, React 19.3.1, TypeScript `^5` (terpasang 5.9.3; dipin starter, bukan 7.x), Tailwind CSS 4.3.3, `@supabase/ssr` 0.12.7, `@supabase/supabase-js` 2.118.0, `eslint-config-next` 16.4.2, ESLint `^9` (`eslint-plugin-react` 7.37.5 belum mendukung ESLint 10), Node.js 24.x (2026-10-23).
- Decision: S1 lulus. `exam.v1.xlsm` yang di-patch di level zip oleh Node (jszip, `src/adapters/workbook/template-patch.ts`) terbuka di Excel 2021 laptop tanpa dialog perbaikan; teks Instructions, data, tombol Finish, dan VBA utuh, dan Finish membaca `WHE_AttemptToken` yang ditulis server. Generate tetap di Node; fallback Python/openpyxl tidak dipakai untuk generate (S2 memutuskan pembaca). Hash `vbaProject.bin` v1 `d8aa9aa6923880439ccd214c559fb48a731091158b0f3e3508c50d35eb11a9df` dicatat di registry. Macro dari file unduhan baru jalan setelah Unblock atau Trusted Location (panduan CAP-16). File hasil generate membawa `<dimension>` dan `spans` lama; pembaca S2 tidak boleh mengandalkannya (entry 2, user, 2026-10-23).
- Decision: S2 lulus. Pembaca WorkbookIO = jszip + fast-xml-parser 5.11.2 (`src/adapters/workbook/read.ts`). Dari file simpanan Excel 2021, teks rumus ternormalisasi (shared formula hasil fill down diperluas, prefiks `_xlfn.` dibuang), nilai cache, dan tipe cocok untuk semua sel fixture; openpyxl sepakat untuk 126 sel. Fallback Python/openpyxl tidak dipakai. SheetJS tidak dievaluasi: `cdn.sheetjs.com` diblokir di container agent, jadi dependensi khusus CDN tidak bisa dipasang di sini. Batasan untuk epic berikut: `WorkbookReading` belum menandai sel hasil spill/array (perlu sebelum grader Level 6), normalisasi membuang semua spasi termasuk operator interseksi, dan use case submit (epic 2) memetakan error pembaca ke `NOT_EXCEL` serta membatasi ukuran unggahan (entry 3, user, 2026-10-23).
- Unknown: apakah Supabase Before User Created hook berjalan untuk sign-up Google OAuth; entry 7 membuktikannya, cek `ALLOWED_EMAIL` di callback tetap wajib.
- Unknown: apakah PC kantor mengizinkan Excel mengirim lewat HTTPS; S3 hanya menguji laptop, PC kantor diuji di epic 2 (upload tetap jalur cadangan).
- Decision: Excel 2021 menulis ulang `vbaProject.bin` setiap kali menyimpan (GUID `ID=`, nilai `CMG`/`DPB`/`GC`, cache kompilasi), sedangkan sumber VBA tiap modul tetap identik. Sidik jari AD-6 harus memakai hash sumber VBA per modul, bukan byte `vbaProject.bin`; spine AD-4/AD-6 diubah lewat `bmad-architecture` sebelum S3 (entry 4). Menjawab Unknown dari S1 (entry 3, 2026-10-23).
- Decision: entry 11 selesai. Sidik jari VBA AD-4 dibaca dengan npm `cfb` 1.2.2 (dipin) dan dekompresi MS-OVBA buatan sendiri (`src/adapters/workbook/vba.ts`); registry v1 mengunci `modFinish` = `914687b34fc5eb2e3c3982861b567ccc25f040fb80543c3986e4935b80f4235c`, dan fixture S2 yang disimpan Excel cocok walau byte `vbaProject.bin` berbeda. Batas dekompresi 16 MiB berlaku per VBA project. Batas yang diterima: p-code tidak ikut sidik jari. Ditunda ke `deferred-work.md`: kode yang ditambahkan ke modul yang tidak dikunci tidak mengubah identitas, dan belum ada CI yang menjalankan `npm test`. Menjawab Unknown entry 11 (user, 2026-10-29).
- Decision: S3 lulus. Tombol Finish (`modFinish`: SaveCopyAs ke `%TEMP%`, `MSXML2.ServerXMLHTTP.6.0`, body `application/octet-stream` dengan byte array dikirim by value, header `X-Attempt-Token`) mengirim dari Excel 2021 laptop ke `POST /api/submissions/macro` di Production: online diterima (31.486 byte, token dan sidik jari cocok), setelah tambah sheet dan membuka VBA editor tetap cocok (32.459 byte), offline menampilkan pesan gagal dengan workbook tetap terbuka dan `%TEMP%` bersih. Antivirus/kebijakan Windows laptop tidak memblokir ServerXMLHTTP. `exam.v1.xlsm` diubah di tempat dan registry v1 `modFinish` = `e8579897d34cb249d4ab70d628c925a37a0ea5e0fa6d35a14ea319b8b04ecc81`; fixture `s3-excel2021.xlsm` menjadi salinan simpanan Excel untuk registry v1. Log memuat `tokenSha256` (12 hex), bukan token. PC kantor tetap Unknown untuk epic 2 (entry 4, user, 2026-10-29).
- Decision: environment dev. Paket gratis Supabase hanya memberi 2 project aktif, jadi "Keuangan Keluarga" di-pause; `excel-practice-dev` (`krfkxropldheqhbqtkfo`, ap-southeast-1) dipakai Preview dan lokal. Skema hanya lewat `supabase/migrations` (`20261029000001_app_meta`, `20261029000002_app_meta_read_only`), diterapkan ke `dev` lalu `prod`; `/health` menampilkan versi skema (entry 5, user, 2026-10-29).
- Decision: CI GitHub Actions menjalankan lint (aturan AD-1 di `src/core`), typecheck, dan Vitest di setiap push dan PR ke `main`; commit uji yang mengimpor `next/server` ke `src/core` membuat CI merah di langkah Lint (entry 6, 2026-10-29).
