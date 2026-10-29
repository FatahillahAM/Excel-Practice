---
title: 'S3: Apakah tombol Finish bisa mengirim file ke HTTPS dari laptop?'
type: 'feature'
ticket: '4'
created: '2026-10-29'
status: 'in-progress'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
baseline_revision: '8b356610c366a467d61773a580f40eb501b57e84'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Belum terbukti bahwa tombol Finish di Excel 2021 laptop bisa mengirim workbook ke `WHE_ServerUrl` lewat HTTPS dan melaporkan status, dan bahwa file yang dikirim tetap cocok dengan sidik jari VBA registry (AD-4) setelah user menambah sheet dan membuka VBA editor. Tanpa bukti ini, jalur macro (CAP-3) tidak bisa dibangun dan upload tetap satu-satunya jalur.

**Approach:** Tambah route `POST /api/submissions/macro` (tanpa sesi, AD-6) yang membaca bytes body dan header `X-Attempt-Token`, membaca workbook, lalu mencatat ukuran, kecocokan token header dengan file, dan kecocokan sidik jari dengan registry v1, lalu membalas envelope `{ ok, data | code }`. Tulis ulang `modFinish` (SaveCopyAs ke folder temp + `MSXML2.ServerXMLHTTP.6.0`, body `application/octet-stream`) yang mengirim ke `WHE_ServerUrl` dan menampilkan status; `exam.v1.xlsm` dibangun ulang di tempat oleh user dan registry v1 dihitung ulang. Endpoint sampai ke Production lewat PR ke `main` yang di-merge user.

**Decisions (user, 2026-10-29):**
- S3 mengubah `exam.v1.xlsm` di tempat karena v1 belum dirilis; sidik jari registry v1 dihitung ulang.
- Log tidak memuat token: log mencatat `tokenSha256` = 12 hex pertama SHA-256 token file, dan `scripts/spike-s1.ts` mencetak nilai yang sama untuk dicocokkan.
- Fixture S2 tetap memuat `modFinish` lama: tesnya membandingkan hash `modFinish` fixture dengan nilai v1 lama (`914687b3…235c`) yang dicatat sebagai konstanta. File yang user simpan dari uji S3 (setelah tambah sheet + Alt+F11) diunggah sebagai `src/adapters/workbook/__fixtures__/s3-excel2021.xlsm` dan menjadi salinan simpanan Excel untuk registry v1; baris Testing spine diperbarui.
- Plan dipertahankan utuh walau di atas 1600 token.

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
- [x] `src/core/submission/rejection-codes.ts` -- enum lima kode AD-6.
- [x] `src/app/api/submissions/macro/route.ts` -- POST sesuai matriks; logika baca-dan-nilai dipisah ke fungsi murni agar bisa dites.
- [x] `src/app/api/submissions/macro/*.test.ts` -- tiap baris matriks sisi server memakai file hasil `patchTemplate`.
- [x] `assets/templates/vba/modFinish.bas` -- Finish baru: baca properti, SaveCopyAs ke `Environ("TEMP")`, kirim bytes dengan header `X-Attempt-Token` dan timeout, tampilkan hasil, hapus salinan.
- [x] `assets/templates/README.md` -- langkah user mengganti `modFinish` di `exam.v1.xlsm` dan langkah uji S3 (online, tambah sheet + Alt+F11, offline).

- [x] `scripts/spike-s1.ts` -- cetak `tokenSha256` (12 hex) di samping token.

- [x] **Execution (setelah user mengunggah template baru):** hitung ulang registry v1 dari file; tes dan `spike-s2.ts` yang memakai fixture S2 untuk registry v1 dipindah ke konstanta `modFinish` lama; PR ke `main`; setelah merge, `node scripts/spike-s1.ts` dan kirim file ke user.

- [x] **Execution (setelah uji laptop):** `s3-excel2021.xlsm` + tes bahwa sidik jarinya cocok dengan registry v1 walau byte `vbaProject.bin` beda dan ada sheet tambahan; baris Testing spine (+ `.memlog.md`) menyebut fixture S3.

**Acceptance Criteria:**
- Given file dari `spike-s1.ts` di Excel 2021 laptop yang sudah Unblock, when Finish diklik online, then MsgBox menampilkan terkirim dan log Production mencatat ukuran yang sama, `tokenMatches` dan `fingerprintMatches` true.
- Given file yang sama setelah sheet ditambah dan VBA editor dibuka, when Finish diklik, then `fingerprintMatches` tetap true.
- Given laptop offline, when Finish diklik, then MsgBox gagal tampil dan workbook tetap terbuka.

## Implementation Notes

- Logika route ada di `src/app/api/submissions/macro/inspect.ts` (`inspectMacroSubmission(bytes, headerToken)` → `{ status, body, log }`); `route.ts` hanya membaca body + header, mencetak `log` sebagai satu baris JSON, dan membalas envelope. Import relatif (bukan `@/`) agar Vitest tanpa config bisa memuatnya.
- Kegagalan apa pun dari `readWorkbook` (bukan hanya `NotAWorkbookError`) → `NOT_EXCEL`, sesuai AD-6 (1) "a workbook the reader cannot read". Token file yang tidak berbentuk base64url 43 karakter → `IDENTITY_ALTERED` (AD-6 (2)). Pemeriksaan content type `.xlsx` tidak ditambahkan: file tanpa VBA project sudah gagal sidik jari → `IDENTITY_ALTERED`.
- Log: `{ channel, code (null bila diterima), bytes, tokenSha256, tokenMatches, fingerprintMatches, templateVersion }`. `scripts/spike-s1.ts` menghitung `tokenSha256` sendiri (skrip Node tidak bisa mengimpor modul app yang import-nya tanpa ekstensi).
- `modFinish.bas`: hanya mengirim bila `WHE_ServerUrl` diawali `https://`; nama identifier dipilih agar tidak ada dua yang hanya beda huruf besar/kecil (VBE akan menyamakan casing dan mengubah sumber). `MsgBox msg` dipertahankan di `ShowAnswer` karena `templates.test.ts` mengeditnya untuk tes "satu karakter berubah".
- Sampai `exam.v1.xlsm` dibangun ulang, golden `vba.test.ts` (template vs `.bas`) gagal karena `.bas` sudah baru; itu yang diharapkan dan pulih di langkah "setelah user mengunggah template baru".
- After the user's rebuild (commit 63da7f2): `exam.v1.xlsm` still has sheets `Instructions`/`Data` and the three `TEMPLATE` properties; its stored `modFinish` normalizes to exactly `modFinish.bas`. Registry v1 `modFinish` = `5a793b180b0329dba3ea6d6f3683251ad19c59188453e45d736240f2cfa877ec`. The S2 file's old hash is `S2_MODFINISH_SHA256` in `__fixtures__/s2-expected.ts`, used by `vba.test.ts`, `templates.test.ts` (S2 no longer matches v1), `read.test.ts:417` (a third site the Code Map missed) and `spike-s2.ts`.

- First laptop run (2026-10-29): Finish failed at "mengirim file ke server" with -2147024809 (E_INVALIDARG, "The parameter is incorrect"); no request reached Production. Cause: `xhr.send fileBytes` passes the Byte() ByRef (VT_BYREF|VT_ARRAY), which ServerXMLHTTP rejects. With the user's hand edit `xhr.send (fileBytes)` in the test file, Production logged `{"channel":"macro","code":"IDENTITY_ALTERED","bytes":31217,"tokenSha256":"42b8cc05ae1e","tokenMatches":true,"fingerprintMatches":false}` (fingerprint off only because of the edit). `modFinish.bas` now passes the array in parentheses; `exam.v1.xlsm` is rebuilt again and registry v1 recomputed.

- Second rebuild (commit 05b239a) with the by-value `send`: stored `modFinish` again equals `modFinish.bas`; registry v1 `modFinish` = `e8579897d34cb249d4ab70d628c925a37a0ea5e0fa6d35a14ea319b8b04ecc81` (supersedes `5a793b18…` above).

- Laptop run (2026-10-29, Production `0cc77ef`, file `spike-s1-pqlxiPRu.xlsm`, `tokenSha256` `69f7f54076ea`): online Finish showed "Terkirim", 31,486 bytes; after adding a sheet and opening the VBA editor, Finish showed "Terkirim", 32,459 bytes (logged twice). Every log line had `code: null`, `tokenMatches: true`, `fingerprintMatches: true`. Offline Finish showed "Gagal mengirim file ke server" with "The server name or address could not be resolved (-2147012889)"; the workbook stayed open and the user found no `whe-finish-*.xlsm` left in `%TEMP%`. ServerXMLHTTP was not blocked by antivirus or policy on the laptop.
- `s3-excel2021.xlsm` (commit 5391895): sheets `Instructions`, `Sheet1` (added), `Data`; new empty module `Sheet3`; `vbaProject.bin` bytes differ from the template; matches registry v1 (test in `templates.test.ts`). Spine Testing row now names it; Deferred "VBA HTTP details" narrowed to the office PC (`.memlog.md` entry).

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
