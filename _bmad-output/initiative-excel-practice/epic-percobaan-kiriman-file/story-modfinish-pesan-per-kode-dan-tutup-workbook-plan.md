---
title: 'modFinish: pesan per kode dan tutup workbook'
type: 'feature'
ticket: '9'
created: '2026-11-06'
status: 'in-progress'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
baseline_revision: '402f8e97e9326e38f99e1957054c1faa07dc3f57'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `modFinish` masih versi spike S3: workbook tidak disimpan maupun ditutup setelah terkirim, penolakan hanya menampilkan "Kode: …" mentah, dan setiap kegagalan disebut masalah koneksi, padahal 413, TLS, dan folder TEMP bukan soal internet. CAP-3 dan sisi macro CAP-18 belum terpenuhi.

**Approach:** `modFinish.bas` menyimpan workbook, mengirim salinannya seperti S3, lalu memetakan setiap jawaban (5 kode AD-6, 413, HTTP lain, error WinHTTP/TEMP) ke satu message box bahasa Indonesia; bila diterima, workbook ditutup (Excel ikut keluar bila tak ada workbook lain yang terlihat). User membangun ulang `exam.v1.xlsm` di Excel laptop (v1 diubah di tempat, keputusan epic 2026-11-02), lalu agent menghitung ulang sidik jari registry v1.

## Boundaries & Constraints

**Always:**
- Teks pesan verbatim dari EXPERIENCE.md › Message set bila ada barisnya; teks baru santai (*kamu*) dan ditandai [ASSUMPTION]. Satu sumber: `macroMessages` di `src/messages/id.ts`, dites sama dengan string di `.bas`.
- Sukses hanya HTTP 200 dengan `"ok":true` (termasuk duplikat); selain itu workbook tetap terbuka dan salinan TEMP dihapus.
- 413 dikenali dari status HTTP saja (batas platform Vercel membalas non-JSON); file > `MAX_SUBMISSION_BYTES` ditolak di VBA tanpa dikirim.
- `.bas` tetap ASCII + CRLF, tanpa key/password, hanya POST ke `WHE_ServerUrl` (AD-13); identifier tidak beda huruf besar/kecil saja; `MsgBox msg` tetap ada (`templates.test.ts` mengubahnya).
- Registry v1 hanya dari adapter pada `.xlsm` yang di-commit (AD-4); tanpa versi v2, tanpa kode baru di `RejectionCode`.

**Never:**
- Agent membuat atau mengubah `xl/vbaProject.bin` sendiri (tanpa Excel tidak ada p-code yang sah); sheet, sel, tombol, atau property template berubah.
- Setup Guide (entry 10), rilis v1 dan uji Production (entry 12), perilaku route/`submit()`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Diterima | 200 `ok:true` (juga `duplicate`) | "File terkirim! Hasilnya muncul di web, ya." → workbook ditutup; Excel keluar bila tak ada workbook lain yang terlihat | — |
| Ditolak | 400 `NOT_THIS_ATTEMPT` / `ALREADY_GRADED` / `IDENTITY_ALTERED` / `ATTEMPT_CLOSED` | pesan baris Message set masing-masing + "Kode: …" | workbook tetap terbuka |
| Bukan Excel | 400 `NOT_EXCEL` | "Server nggak bisa membaca file ini sebagai file Excel. Upload file ini lewat web, ya." [ASSUMPTION] | idem |
| Terlalu besar | > 4 MiB lokal, atau HTTP 413 | "File ini terlalu besar (maksimal 4 MB). Pakai file .xlsm asli dari Start, ya." (sama dengan upload) | idem, tanpa arahan upload |
| Jaringan / server | resolve/connect/timeout, 500, HTTP lain, kode tak dikenal | "File belum terkirim. Filenya sudah tersimpan — upload lewat web, ya." + "Detail: …" | idem |
| TLS | error WinHTTP sertifikat/secure channel | "Koneksi aman ke server gagal. Biasanya karena tanggal dan jam laptop salah, bukan internet kamu. Cek jamnya lalu klik Finish lagi, atau upload lewat web, ya." [ASSUMPTION] | idem |
| TEMP | `TEMP`/`TMP` kosong atau `SaveCopyAs` gagal | "Salinan file nggak bisa dibuat di folder TEMP Windows. Filenya sudah tersimpan — upload lewat web, ya." [ASSUMPTION] | idem |
| Simpan gagal | `ThisWorkbook.Save` error (read-only) | "File belum bisa disimpan, jadi belum dikirim. Simpan dulu ke folder kerja kamu (Ctrl+S), lalu klik Finish lagi, ya." [ASSUMPTION] | tidak dikirim |
| Property `TEMPLATE` | template mentah | pesan "tidak berisi data ujian yang lengkap" tetap (README langkah 7) | tidak dikirim |

</frozen-after-approval>

## Code Map

- `assets/templates/vba/modFinish.bas` -- S3 Finish: `SaveCopyAs` → `ServerXMLHTTP.6.0` octet-stream + `X-Attempt-Token`, `send (fileBytes)` by value; `ShowAnswer`, `AnswerCode`, `TempCopyPath` (comment says "workbook's own extension", code always `.xlsm`).
- `assets/templates/exam.v1.xlsm`, `assets/templates/README.md` -- template; section "Mengganti `modFinish`" is the rebuild procedure (S3).
- `src/adapters/workbook/templates.ts` (+test) -- registry v1 `modFinish` = `e8579897…`; test recomputes from the committed file.
- `src/adapters/workbook/vba.test.ts` -- golden: template's stored `modFinish` == `.bas` (fails between `.bas` edit and rebuild, expected).
- `src/adapters/workbook/__fixtures__/s3-excel2021.xlsm` -- Excel-saved v1 with the old modFinish; used by `templates.test.ts`, `macro/route.test.ts`, `upload/route.test.ts` (`readS3Fixture`); stops matching v1 after the rebuild.
- `src/app/api/submissions/http.ts` -- compact `{"ok":true,…}` / `{"ok":false,"code":"…"}`, 200/400/413/500.
- `src/messages/id.ts` -- `uploadMessages` (verbatim rows, `FILE_TOO_LARGE`); `MAX_SUBMISSION_BYTES` in `src/core/submission/submit.ts`.
- `scripts/spike-s1.ts` -- `--template <file>` prints the `registry entry:`; `--server-url` makes a test file with an unknown token.

## Tasks & Acceptance

**Execution (agent, before the laptop):**
- [ ] `src/messages/id.ts` -- `macroMessages`: rows of the matrix (verbatim reuse of `uploadMessages` rejection strings).
- [ ] `assets/templates/vba/modFinish.bas` -- `Save` → size check → copy → send → map per matrix; TLS by `Err.Number` (Design Notes); on success `MsgBox` then close/quit; fix the `TempCopyPath` comment; header comment updated.
- [ ] `src/adapters/workbook/modfinish-source.test.ts` -- `.bas` is ASCII+CRLF; holds every `macroMessages` string (em dash as `ChrW$(8212)`), every `RejectionCode`, `MAX_SUBMISSION_BYTES`, `SUBMIT_PATH`; `MsgBox msg` present.
- [ ] `assets/templates/README.md` -- rebuild section generalized (S3 → 2.9), plus the new fixture steps.
- [ ] Commit and push the work branch (not `main`) so the user can download the `.bas`.

**Laptop (user, hitl) — checklist:**
1. Dari branch kerja di GitHub unduh `assets/templates/exam.v1.xlsm` dan `assets/templates/vba/modFinish.bas` (**Download raw file**, jangan copy-paste).
2. Ikuti README › "Mengganti `modFinish`": Unblock, buka, **Alt+F11**, Remove `modFinish` (jawab **No**), **Import File…**, **Debug → Compile VBAProject** tanpa error, tutup editor tanpa mengetik apa pun.
3. Klik **Finish**: harus muncul "File ini tidak berisi data ujian yang lengkap." Klik **A1** di `Instructions`, **Ctrl+S**, tutup Excel.
4. Unggah `exam.v1.xlsm` ke `assets/templates/` di branch kerja, beri tahu agent, tunggu Preview branch itu siap.
5. Di Preview: Start L1 P1, simpan file ke folder kerja, buka. Tambah satu sheet, **Alt+F11** buka `modFinish` tanpa mengetik, tutup editor; **File → Save As** ke folder lain dengan nama `s3-excel2021.xlsm` (format `.xlsm`), tutup Excel. Fixture ini jangan di-Finish.
6. Buka lagi file percobaan dari folder kerja (hanya file ini yang terbuka), klik **Finish**: "File terkirim!…", workbook tertutup, Excel ikut tertutup; web pindah ke "File received — grading…".
7. Abandon percobaan itu di Dashboard; buka file yang sama, **Finish**: "Percobaan ini sudah ditutup…", workbook tetap terbuka. Tutup.
8. Start baru; buka file, buka satu workbook kosong lain; ketik `Sub X()` / `End Sub` di modul `Sheet1`, **Finish**: pesan "Identitas file ini rusak…", tetap terbuka. Hapus kode itu, **Finish** lagi: terkirim, hanya workbook ini yang tertutup, Excel tetap terbuka.
9. Buka file `spike-s1-….xlsm` dari agent, **Finish**: "File ini bukan dari percobaan yang sedang berjalan…".
10. Matikan Wi-Fi, buka lagi file dari langkah 8, **Finish**: "File belum terkirim…", tetap terbuka, `%TEMP%` tanpa `whe-finish-*.xlsm`.
11. Tiap message box: **Ctrl+C**, tempel ke chat. Unggah `s3-excel2021.xlsm` ke `src/adapters/workbook/__fixtures__/` di branch kerja.

**Execution (agent, after the laptop):**
- [ ] `src/adapters/workbook/templates.ts` -- v1 `modFinish` from `node scripts/spike-s1.ts --template assets/templates/exam.v1.xlsm`; golden and registry tests green; the new `s3-excel2021.xlsm` matches v1 (route and template tests unchanged).
- [ ] Before step 9: `node scripts/spike-s1.ts --server-url <Preview URL>` → send the file to the user.
- [ ] Record the pasted message boxes and fingerprint in Implementation Notes.

**Acceptance Criteria:**
- Given the rebuilt `exam.v1.xlsm`, when CI runs, then the stored `modFinish` equals `modFinish.bas` and its hash equals registry v1, also in the Excel-saved fixture.
- Given checklist steps 6–10 on the laptop, then an accepted Finish closes the workbook (and Excel only when nothing else is open), and each refused file shows its code's message with the workbook still open.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).

- Agent work makes no Supabase or Vercel setting changes; the only remote action is pushing the work branch for the laptop loop.

## Plan Change Log

## Review Triage Log

## Design Notes

- Save first: CAP-3 says Finish saves and sends, and the verbatim send-failed text claims "Filenya sudah tersimpan". `SaveCopyAs` to TEMP stays (proven in S3); the open file is not read while Excel holds it.
- Close: `MsgBox` first, then `ThisWorkbook.Saved = True`; other workbook with a visible window (PERSONAL.XLSB is hidden) → `ThisWorkbook.Close False`, else `Application.Quit`.
- TLS = WinHTTP errors `-2147012721` (SECURE_FAILURE), `-2147012739` (SECURE_CHANNEL_ERROR), `-2147012859`/`-2147012858`/`-2147012851` (cert date, name, CA), `-2147012839` (revocation). S3 offline gave `-2147012889` (not resolved) → network row.
- [ASSUMPTION] A "Kode: …"/"Detail: …" line stays under each failure message so the user can report it (EXPERIENCE forbids codes *alone*).
- [ASSUMPTION] `NOT_EXCEL` via macro gets its own sentence: the Message set row is upload-only and tells the user to pick another file.
- [ASSUMPTION] The "data tidak lengkap" box keeps its current wording: README steps 3/7 rely on it.
- [ASSUMPTION] The rebuild replaces `s3-excel2021.xlsm` in place (same path and procedure), so the spine Testing row and route tests keep working; the old file would fail v1 like S2.
- [ASSUMPTION] Rebuilding invalidates open dev/prod attempts made from the old v1 (`IDENTITY_ALTERED`); acceptable because v1 is unreleased — abandon them first.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: clean after the rebuild; before it only the `vba.test.ts` golden fails.

**Manual checks (if no CLI):**
- Laptop checklist 6–10 with pasted message boxes; 413/TLS/TEMP rows are reviewed in code only (not reproducible on the laptop).
