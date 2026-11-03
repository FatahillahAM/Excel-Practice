---
title: 'Upload Dropzone dan route upload'
type: 'feature'
ticket: '5'
created: '2026-11-03'
status: 'in-progress'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
baseline_revision: 'aa9b078eaf459420bdd7c88423d8730baf66c93f'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Saat macro diblokir (PC kantor, J2) file tidak punya jalan ke server: belum ada `POST /api/submissions/upload` dan layar exam belum punya Upload Dropzone, jadi CAP-4 dan penolakan per alasan lewat web (CAP-18) belum ada.

**Approach:** Route upload memeriksa sesi, membaca body dengan batas yang sama seperti macro, lalu memanggil `submit(bytes, { kind: "upload" }, ports)` dengan port sesi; respons dan pemetaan HTTP dibagi dengan route macro. Dropzone di layar exam (hanya saat `open`) mengirim satu file, menampilkan pesan penolakan inline, dan saat diterima layar langsung berpindah ke "File received — grading…".

## Boundaries & Constraints

**Always:**
- Percobaan ditentukan token file (AD-6 langkah 3), bukan id di URL; tanpa field atau kode baru di API. Pemilik lewat RLS sesi: token milik orang lain = `NOT_THIS_ATTEMPT`.
- Port sesi (AD-9): tanpa service role di jalur upload. File dan status sama seperti macro: `submission-1.xlsm` ditimpa selama `open`, lalu CAS `open` → `received`.
- Satu modul untuk batas body (4 MiB → 413), envelope `{ok, data: {status, duplicate}} | {ok:false, code}`, dan log JSON (`channel: "upload"`); route macro memakainya, perilakunya tetap.
- Dropzone: `<input type="file">` asli, `accept=".xlsm,.xlsx"`, satu file, bisa `Tab` + `Enter`/`Space`, drag-and-drop opsional; tinggi 40px, token `upload-dropzone` DESIGN.md.
- Pesan Indonesian di `src/messages/id.ts`, verbatim dari EXPERIENCE.md › Message set, `lang="id"`; penolakan `role="alert"`, "Uploading…" polite.

**Never:**
- Penilaian `after()`, Results, "Try again", hint (epic 3); pesan modFinish (entry 9); isi Setup Guide (entry 10).
- Kode baru di `RejectionCode`; multipart/`formData()` (membaca body tanpa batas); persen progres; DOM test harness (epic 4).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Diterima | `.xlsm` percobaan ini, `open` | 200 `received`; layar langsung "File received — grading…", Dropzone hilang | simpan/CAS gagal → 500, pesan koneksi, tetap `open` |
| Duplikat | Finish sudah terkirim | 200 `duplicate: true`; layar ke status itu | — |
| File lama | token tak dikenal | `NOT_THIS_ATTEMPT`: "File ini bukan dari percobaan yang sedang berjalan…" | percobaan tetap `open`, Dropzone siap lagi |
| Save As | `.xlsx`, modFinish diubah | `IDENTITY_ALTERED`: "Identitas file ini rusak atau berubah…" | idem |
| Bukan Excel | `.pdf`, `.docx`, kosong | `NOT_EXCEL`: "Ini bukan file Excel…" | idem |
| Sudah dinilai / dibatalkan | file percobaan `graded` / `abandoned` | `ALREADY_GRADED` / `ATTEMPT_CLOSED`, pesan masing-masing | idem |
| Milik orang lain | token percobaan user lain | `NOT_THIS_ATTEMPT` (RLS) | — |
| Terlalu besar | > 4 MiB | klien menolak tanpa kirim; server 413 `FILE_TOO_LARGE` | pesan ukuran |
| Tanpa sesi | sesi habis | 401 `UNAUTHENTICATED` sebelum body dibaca | layar ke first-load alert + "Try again" |
| Jaringan putus | fetch gagal | pesan koneksi | Dropzone siap lagi |
| Bukan `open` | `received`, `grading_failed`, tutup | Dropzone tidak dirender | — |
| Banyak file | drop 2 file | hanya file pertama dikirim | — |

</frozen-after-approval>

## Code Map

- `src/core/submission/submit.ts` -- `submit()`; `Channel { kind: "upload" }` skips the header check; `MAX_SUBMISSION_BYTES`, `SubmissionFault`.
- `src/app/api/submissions/macro/route.ts` (+tests) -- `readBoundedBody`, `MacroBody`, the 200/400/413/500 mapping and log line; moved to a shared module.
- `src/adapters/supabase/attempts.ts` -- `findAttemptByTokenHash`, `markReceived`, `storeSubmissionFile({replace})`; docs say "macro path / service role", now session too.
- `src/adapters/supabase/{auth,server,auth-rules,proxy}.ts` -- `getSessionUser`, `createClient`, `UNAUTHENTICATED`; `/api/submissions/upload` is not a public path, so the proxy already answers 401.
- `supabase/migrations/20261102000001_attempts.sql`, `20261103000001_attempts_abandon.sql` -- the owner may only move to `abandoned`; in Storage the owner may only insert `generated.xlsm`.
- `supabase/tests/contract.db.test.ts` -- "refuses the owner moving an open attempt to received" (changes) and "…grading_failed attempt back to received" (stays 42501).
- `src/app/(app)/exam/[attemptId]/{page,exam-status}.tsx` -- Dropzone slot comment; `setStatus`, `receivedAnchor`, `setLost`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/app/api/submissions/http.ts` (+tests) -- `readBoundedBody` (moved), `SubmissionBody`, `submissionResponse(result, channel)` (HTTP status, log line, error log `<channel>.<failure>`), `bodyFault(code, channel)` -- one mapping for both channels.
- [ ] `src/app/api/submissions/macro/route.ts` -- use `http.ts`; `MacroBody` = alias of `SubmissionBody`; macro tests pass unchanged.
- [ ] `supabase/migrations/20261103000002_attempts_upload.sql` -- owner update policy `open` → `received`; a `before update` trigger that, for `authenticated`, allows only `open → received` and `open|received|grading_failed → abandoned` (else `42501`), since permissive policies are OR-ed; Storage insert + update policies for the owner on `<id>/submission-1.xlsm` while `open`; bump `schema_version`.
- [ ] `supabase/tests/contract.db.test.ts` -- owner `open → received` allowed (stamps `received_at`), `grading_failed → received` still 42501, other user 0 rows; Storage: owner writes and overwrites `submission-1` while `open`, not when `received` or someone else's.
- [ ] `src/adapters/supabase/attempts.ts` -- docs and parameter names: lookup, CAS and store take the session or the service client.
- [ ] `src/app/api/submissions/upload/route.ts` (+tests) -- session first (401 without reading the body), bounded body, session ports from `createClient()`, `submit(…, { kind: "upload" })`. Tests: one fixture per code, duplicate, 401, 413 (Content-Length and stream), 500 on store failure, another user's token → `NOT_THIS_ATTEMPT`, and parity: the same fixtures through macro and upload give the same code and status.
- [ ] `src/messages/id.ts` -- `uploadMessages`: the five codes verbatim; `FILE_TOO_LARGE` "File ini terlalu besar (maksimal 4 MB). Pakai file .xlsm asli dari Start, ya." and `failed` = the "network" row (illustrative, like `startMessages`).
- [ ] `src/app/(app)/exam/[attemptId]/upload.ts` (+tests) -- pure: `pickFile(files)` (first or `null`), `tooLarge(size)`, `uploadOutcome(httpStatus, body)` → `received {status} | rejected {message} | session_lost | failed`; unknown code → `failed`.
- [ ] `src/app/(app)/exam/[attemptId]/upload-dropzone.tsx` -- "Upload file (.xlsm)" control on a visually hidden input; drag-over "Drop to upload"; uploading (`role="status"` "Uploading…", indeterminate bar, input disabled); rejected (`role="alert"`, ✗ + message + pick-again control, per `key-exam.html`); `fetch` with the `File` as `application/octet-stream` body.
- [ ] `src/app/(app)/exam/[attemptId]/exam-status.tsx` -- render the Dropzone under the status line only while `open`; `onReceived(status)` → `setStatus` + received anchor 0 (as when a poll sees the transition); `onSessionLost` → `setLost(true)`. Drop the slot comment in `page.tsx`.
- [ ] `src/app/(app)/exam/[attemptId]/page.test.tsx` -- `open`: `input type="file"` with `accept=".xlsm,.xlsx"`, the control label, no `role="alert"`; `received`/`grading_failed`: no input.

**Acceptance Criteria:**
- Given macros are blocked and the exam screen is `open`, when the `.xlsm` from Start is picked by keyboard, then the screen shows "File received — grading…" without waiting for a poll, and `attempt-files/<id>/submission-1.xlsm` exists.
- Given the wrong files of the matrix, when uploaded one after another, then each shows its own message in `role="alert"` and the attempt stays `open`.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).

## Plan Change Log

## Review Triage Log

## Design Notes

- Token, not `attemptId`: matching the screen's id first would turn graded or abandoned files into `NOT_THIS_ATTEMPT`, while Done when 3 wants each its own message. One attempt in progress per user (AD-5) means an accepted file always belongs to the attempt on screen, except a screen stale ≤ 2 s after Abandon on another device; its next poll then shows its own status.
- Session, not service role: AD-9 keeps the service role to macro and grading. The new permissive update policy is OR-ed with Abandon's, which would also let `grading_failed → received` through; the pair-guard trigger keeps that contract test at 42501. Core stays the one decider of transitions (AD-5).
- `accept=".xlsm,.xlsx"` follows EXPERIENCE.md › Upload Dropzone: a Save-As `.xlsx` copy can be picked and gets the identity message instead of being filtered silently.
- Raw body like macro: the same `readBoundedBody` applies; `fetch` has no upload progress, so the bar is indeterminate (files ≤ 4 MiB).
- No DOM harness (epic 4): client logic lives in `upload.ts`; drag, focus and the transition are manual checks.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: clean; CI job `db-contract` green.

**Manual checks (if no CLI):**
- Preview (`dev`, after the migration): Start → upload the real file via `Tab`/`Enter` → "File received — grading…"; old file, `.xlsx`, PDF, an abandoned attempt's file → each its own message; drag-over and drop; NVDA reads "Uploading…" and the rejection.
