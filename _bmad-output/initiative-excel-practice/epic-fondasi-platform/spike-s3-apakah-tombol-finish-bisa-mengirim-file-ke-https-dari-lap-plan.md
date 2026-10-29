---
title: 'S3: Apakah tombol Finish bisa mengirim file ke HTTPS dari laptop?'
type: 'feature'
ticket: '4'
created: '2026-10-29'
status: 'draft'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Belum terbukti bahwa tombol Finish di Excel 2021 laptop bisa mengirim workbook ke `WHE_ServerUrl` lewat HTTPS dan melaporkan status, dan bahwa file yang dikirim tetap cocok dengan sidik jari VBA registry (AD-4) setelah user menambah sheet dan membuka VBA editor. Tanpa bukti ini, jalur macro (CAP-3) tidak bisa dibangun dan upload tetap satu-satunya jalur.

**Approach:** Tambah route `POST /api/submissions/macro` (tanpa sesi, AD-6) yang membaca bytes body dan header `X-Attempt-Token`, membaca workbook, lalu mencatat ukuran, kecocokan token header dengan file, dan kecocokan sidik jari dengan registry v1, lalu membalas envelope `{ ok, data | code }`. Tulis ulang `modFinish` (SaveCopyAs ke folder temp + `MSXML2.ServerXMLHTTP.6.0`, body `application/octet-stream`) yang mengirim ke `WHE_ServerUrl` dan menampilkan status; `exam.v1.xlsm` dibangun ulang di tempat oleh user dan registry v1 dihitung ulang. Endpoint sampai ke Production lewat PR ke `main` yang di-merge user.

**Decisions (user, 2026-10-29):**
- S3 mengubah `exam.v1.xlsm` di tempat karena v1 belum dirilis; sidik jari registry v1 dihitung ulang.

## Boundaries & Constraints

**Always:** route tidak menulis DB atau Storage dan tidak memanggil Supabase; kode penolakan memakai nama AD-6 dari enum `src/core/submission/rejection-codes.ts`; log berupa satu baris JSON dengan `channel: "macro"` dan `code`, tanpa bytes file, token, atau email (Consistency Conventions › Logging); VBA tidak menyimpan kunci atau password dan hanya mengirim ke `WHE_ServerUrl` (AD-13); gagal kirim tidak menutup workbook; versi pembanding sidik jari = `CURRENT_TEMPLATE_VERSION`, bukan `WHE_TemplateVersion`.

**Never:** use case `submit()`, tabel `attempts`, penyimpanan file, atau urutan keputusan AD-6 lengkap (epic 2); batas ukuran unggahan (Deferred); mengubah perilaku patch, pembacaan sel, atau `vba.ts`; menyimpan atau menutup workbook asli dari macro.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Kirim sah | file hasil patch v1 baru + header = token file | 200 `{ ok: true, data: { bytes, tokenMatches: true, fingerprintMatches: true } }`; log JSON | — |
| Tambah sheet + VBA editor | sama, setelah sheet baru dan Alt+F11 | `fingerprintMatches: true` | — |
| Bukan workbook | body kosong atau bukan zip/OOXML | 400 `{ ok: false, code: "NOT_EXCEL" }` | log `code` |
| Header hilang/beda | header kosong atau ≠ `WHE_AttemptToken` file | 400 `IDENTITY_ALTERED` | log `code` |
| Modul terkunci berubah | `modFinish` diedit | 400 `IDENTITY_ALTERED` | log `code` |
| Tanpa jaringan (VBA) | laptop offline | MsgBox gagal, workbook tetap terbuka, salinan temp dihapus | `On Error` di VBA |
| Server menolak (VBA) | balasan `ok: false` | MsgBox menampilkan `code` | — |

</frozen-after-approval>

## Code Map

- `src/adapters/workbook/read.ts` -- `readWorkbook(bytes)` → `{ sheets, properties, vbaModuleHashes }`; melempar `NotAWorkbookError` untuk bukan workbook (→ `NOT_EXCEL`). Jangan diubah.
- `src/adapters/workbook/templates.ts` -- `matchesTemplate`, `pinnedModules`, `CURRENT_TEMPLATE_VERSION`; registry v1 `modFinish` diganti nilai baru setelah template dibangun ulang.
- `src/proxy.ts` -- matcher juga menjalankan `updateSession` di `/api/*`; hanya refresh sesi, tidak memblokir. Biarkan.
- `src/app/` -- belum ada route handler; `next.config.ts` memakai `cacheComponents` (POST handler tetap dinamis). Runtime Node (default), `cfb` memakai `Buffer`.
- `assets/templates/vba/modFinish.bas` -- ASCII + CRLF (`.gitattributes`: `*.bas -text`); `Sub Finish` dipanggil tombol, nama dipertahankan.
- `assets/templates/README.md` -- panduan bangun template; tambah langkah ganti modul.
- `scripts/spike-s1.ts` -- membuat file uji dengan token acak, `--server-url` default Production.
- Tes yang memakai fixture S2 sebagai salinan simpanan Excel untuk registry v1: `templates.test.ts:82-87`, `vba.test.ts:148-153`, golden `vba.test.ts:135-138` (template vs `.bas`); `scripts/spike-s2.ts:115-117`.
- Vercel: Production = `main`; log dibaca lewat Vercel MCP `get_runtime_logs` (project `prj_XsK8V22z4ulZeOjg7sNqJMQYFobE`).

## Tasks & Acceptance

**Execution (agent, sebelum laptop):**
- [ ] `src/core/submission/rejection-codes.ts` -- enum lima kode AD-6.
- [ ] `src/app/api/submissions/macro/route.ts` -- POST sesuai matriks; logika baca-dan-nilai dipisah ke fungsi murni agar bisa dites.
- [ ] `src/app/api/submissions/macro/*.test.ts` -- tiap baris matriks sisi server memakai file hasil `patchTemplate`.
- [ ] `assets/templates/vba/modFinish.bas` -- Finish baru: baca properti, SaveCopyAs ke `Environ("TEMP")`, kirim bytes dengan header `X-Attempt-Token` dan timeout, tampilkan hasil, hapus salinan.
- [ ] `assets/templates/README.md` -- langkah user mengganti `modFinish` di `exam.v1.xlsm` dan langkah uji S3 (online, tambah sheet + Alt+F11, offline).

**Execution (setelah user mengunggah template baru):** hitung ulang registry v1 dari file; sesuaikan tes fixture S2 (Open Question 2); PR ke `main`; setelah merge, `node scripts/spike-s1.ts` dan kirim file ke user.

**Acceptance Criteria:**
- Given file dari `spike-s1.ts` di Excel 2021 laptop yang sudah Unblock, when Finish diklik online, then MsgBox menampilkan terkirim dan log Production mencatat ukuran yang sama, `tokenMatches` dan `fingerprintMatches` true.
- Given file yang sama setelah sheet ditambah dan VBA editor dibuka, when Finish diklik, then `fingerprintMatches` tetap true.
- Given laptop offline, when Finish diklik, then MsgBox gagal tampil dan workbook tetap terbuka.

## Open Questions

1. **Token di log.** Ticket meminta log mencatat "token yang sama", tapi konvensi Logging melarang token di log.
   - A (disarankan): log dan `spike-s1.ts` sama-sama mencetak 12 hex pertama SHA-256 token; konvensi utuh, tetap bisa dicocokkan.
   - B: log token mentah sebagai pengecualian spike; melanggar konvensi di Production.
2. **Fixture S2 setelah `modFinish` berubah.** `s2-excel2021.xlsm` memuat `modFinish` lama, jadi tes "simpanan Excel cocok dengan registry v1" akan gagal.
   - A (disarankan): tes S2 membandingkan hash `modFinish` fixture dengan nilai v1 lama yang dicatat sebagai konstanta (bukti simpanan Excel tetap sama); file yang Anda simpan dari uji S3 (setelah tambah sheet + Alt+F11) diunggah sebagai `s3-excel2021.xlsm` dan menjadi salinan simpanan Excel untuk registry v1; baris Testing spine diperbarui.
   - B: Anda membuat ulang fixture S2 dengan template baru (ketik ulang rumus S2).

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

Body dikirim sebagai `application/octet-stream` (bukan multipart), dan `ServerXMLHTTP.6.0` dipilih sesuai ticket; keduanya menjawab Deferred "VBA HTTP details" untuk laptop. `SaveCopyAs` menyimpan isi workbook saat ini tanpa mengubah file aslinya. Byte array VBA dibaca dengan `Open … For Binary` lalu `send` langsung. Route ini adalah tempat jalur macro epic 2; isinya nanti diganti `submit(bytes, "macro")`.

## Verification

**Commands:**
- `npm run test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` -- expected: bersih.
- `node scripts/spike-s1.ts` -- expected: registry check match dengan template baru.

**Manual checks:**
- Laptop: tiga skenario di Acceptance Criteria; Vercel runtime logs Production menunjukkan baris JSON yang sesuai.
