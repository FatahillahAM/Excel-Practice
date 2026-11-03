---
title: 'Upload Dropzone dan route upload'
type: 'feature'
ticket: '5'
created: '2026-11-03'
status: done
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: 'aa9b078eaf459420bdd7c88423d8730baf66c93f'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Saat macro diblokir (PC kantor, J2) file tidak punya jalan ke server: belum ada `POST /api/submissions/upload` dan layar exam belum punya Upload Dropzone, jadi CAP-4 dan penolakan per alasan lewat web (CAP-18) belum ada.

**Approach:** Route upload memeriksa sesi, membaca body dengan batas yang sama seperti macro, lalu memanggil `submit(bytes, { kind: "upload" }, ports)` dengan port service role yang hanya menerima percobaan milik user sesi; respons dan pemetaan HTTP dibagi dengan route macro. Dropzone di layar exam (hanya saat `open`) mengirim satu file, menampilkan pesan penolakan inline, dan saat diterima layar langsung berpindah ke "File received — grading…".

## Boundaries & Constraints

**Always:**
- Percobaan ditentukan token file (AD-6 langkah 3), bukan id di URL; tanpa field atau kode baru di API. Pemilik dicek di server: token percobaan yang `user_id`-nya bukan user sesi = `NOT_THIS_ATTEMPT`.
- Service role setelah cek sesi (AD-9, user 2026-11-03): sesi tidak mendapat izin tulis baru di database atau Storage. File dan status sama seperti macro: `submission-1.xlsm` ditimpa selama `open`, lalu CAS `open` → `received`.
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
| Milik orang lain | token percobaan user lain | `NOT_THIS_ATTEMPT` (cek `user_id`) | — |
| Terlalu besar | > 4 MiB | klien menolak tanpa kirim; server 413 `FILE_TOO_LARGE` | pesan ukuran |
| Tanpa sesi | sesi habis | 401 `UNAUTHENTICATED` sebelum body dibaca | layar ke first-load alert + "Try again" |
| Jaringan putus | fetch gagal | pesan koneksi | Dropzone siap lagi |
| Bukan `open` | `received`, `grading_failed`, tutup | Dropzone tidak dirender | — |
| Banyak file | drop 2 file | hanya file pertama dikirim | — |

</frozen-after-approval>

## Code Map

- `src/core/submission/submit.ts` -- `submit()`; `Channel { kind: "upload" }` skips the header check; `MAX_SUBMISSION_BYTES`, `SubmissionFault`.
- `src/app/api/submissions/macro/route.ts` (+tests) -- `readBoundedBody`, `MacroBody`, the 200/400/413/500 mapping and log line; moved to a shared module.
- `src/adapters/supabase/attempts.ts` -- `findAttemptByTokenHash`, `markReceived`, `storeSubmissionFile({replace})`; service role on both submission paths; the lookup also returns `userId`.
- `src/adapters/supabase/{auth,server,auth-rules,proxy}.ts` -- `getSessionUser`, `createClient`, `UNAUTHENTICATED`; `/api/submissions/upload` is not a public path, so the proxy already answers 401.
- `supabase/migrations/20261102000001_attempts.sql`, `20261103000001_attempts_abandon.sql` -- the owner may only move to `abandoned`; in Storage the owner may only insert `generated.xlsm`.
- `supabase/tests/contract.db.test.ts` -- the session still cannot move `open`/`grading_failed` → `received` or write `submission-1.xlsm` (no migration for 2.5).
- `src/app/(app)/exam/[attemptId]/{page,exam-status}.tsx` -- Dropzone slot comment; `setStatus`, `receivedAnchor`, `setLost`.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/api/submissions/http.ts` (+tests) -- `readBoundedBody` (moved), `SubmissionBody`, `submissionResponse(result, channel)` (HTTP status, log line, error log `<channel>.<failure>`), `bodyFault(code, channel)` -- one mapping for both channels.
- [x] `src/app/api/submissions/macro/route.ts` -- use `http.ts`; `MacroBody` = alias of `SubmissionBody`; macro tests pass unchanged.
- [x] ~~`supabase/migrations/20261103000002_attempts_upload.sql`~~ -- dropped after review (user 2026-11-03): upload uses the service role after the session check; no migration.
- [x] `supabase/tests/contract.db.test.ts` -- the session cannot move `open`/`grading_failed` → `received` (42501) and cannot write or overwrite `submission-1.xlsm`.
- [x] `src/adapters/supabase/attempts.ts` -- docs: lookup and CAS are service role for both submission paths; the lookup returns `userId` for upload's owner check (`src/app/api/submissions/service-ports.ts`).
- [x] `src/app/api/submissions/upload/route.ts` (+tests) -- session first (401 without reading the body), bounded body, session ports from `createClient()`, `submit(…, { kind: "upload" })`. Tests: one fixture per code, duplicate, 401, 413 (Content-Length and stream), 500 on store failure, another user's token → `NOT_THIS_ATTEMPT`, and parity: the same fixtures through macro and upload give the same code and status.
- [x] `src/messages/id.ts` -- `uploadMessages`: the five codes verbatim; `FILE_TOO_LARGE` "File ini terlalu besar (maksimal 4 MB). Pakai file .xlsm asli dari Start, ya." and `failed` = the "network" row (illustrative, like `startMessages`).
- [x] `src/app/(app)/exam/[attemptId]/upload.ts` (+tests) -- pure: `pickFile(files)` (first or `null`), `tooLarge(size)`, `uploadOutcome(httpStatus, body)` → `received {status} | rejected {message} | session_lost | failed`; unknown code → `failed`.
- [x] `src/app/(app)/exam/[attemptId]/upload-dropzone.tsx` -- "Upload file (.xlsm)" control on a visually hidden input; drag-over "Drop to upload"; uploading (`role="status"` "Uploading…", indeterminate bar, input disabled); rejected (`role="alert"`, ✗ + message + pick-again control, per `key-exam.html`); `fetch` with the `File` as `application/octet-stream` body.
- [x] `src/app/(app)/exam/[attemptId]/exam-status.tsx` -- render the Dropzone under the status line only while `open`; `onReceived(status)` → `setStatus` + received anchor 0 (as when a poll sees the transition); `onSessionLost` → `setLost(true)`. Drop the slot comment in `page.tsx`.
- [x] `src/app/(app)/exam/[attemptId]/page.test.tsx` -- `open`: `input type="file"` with `accept=".xlsm,.xlsx"`, the control label, no `role="alert"`; `received`/`grading_failed`: no input.

**Acceptance Criteria:**
- Given macros are blocked and the exam screen is `open`, when the `.xlsm` from Start is picked by keyboard, then the screen shows "File received — grading…" without waiting for a poll, and `attempt-files/<id>/submission-1.xlsm` exists.
- Given the wrong files of the matrix, when uploaded one after another, then each shows its own message in `role="alert"` and the attempt stays `open`.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).

## Plan Change Log

- 2026-11-03 (review, user decision): upload ports on the service role after the session check, owner checked by `user_id`; migration `20261103000002` and its contract tests removed. Upload also requires `Content-Type: application/octet-stream` (415 `UNSUPPORTED_MEDIA_TYPE`, client `failed`), logs every answer (401 included), answers 500 on any throw; `inFlight` lock; 200 only for `received`/`grading_failed`; `afterUpload()` and `receivedAnchorOnChange()` extracted.

## Review Triage Log

Thorough lenses (blind-hunter, edge-case-hunter, verification-gap, intent-alignment): 1 high (HALT, user decided), 3 medium and 4 low patched; 1 deferred; the rest rejected.

| # | Finding (lens) | Verdict | Route | Evidence |
|---|----------------|---------|-------|----------|
| 1 | Session write grants let the owner bypass `submit()`: PATCH status to `received` without a file, or write any bytes to `submission-1.xlsm` (blind, edge) | high | HALT → user 2026-11-03: service role after the session check | Migration deleted; `serviceSubmissionPorts(channel, ownerId)` treats another user's attempt as not found; spine AD-9 and `.memlog.md` amended; contract tests assert the session still cannot move status or write the file |
| 2 | Guard trigger fired on every UPDATE; `grading_failed → received` row missing (blind) | medium | patch (obsolete) | Trigger removed with the migration; session-refusal rows added |
| 3 | No fault handling around session/client/`submit()` in the upload route; 401 skipped the shared log (blind, edge) | medium | patch | `upload.session_failed` / `submit_failed` / `service_*` → JSON 500; every answer logs one line |
| 4 | Cookie-authenticated POST reads any content type (cross-site simple request) (blind) | medium | patch | `application/octet-stream` required, else 415 `UNSUPPORTED_MEDIA_TYPE` (route fault, not a RejectionCode) |
| 5 | Two drops before re-render post twice (blind, edge) | low | patch | `inFlight` ref lock |
| 6 | `uploadOutcome` accepted any status on 200 (blind) | low | patch | Only `received`/`grading_failed`; others `failed` |
| 7 | Outcome handling in `send()` and the received-anchor rule untested and duplicated (verification-gap) | low | patch | Pure `afterUpload` and `receivedAnchorOnChange`, both tested; one `applyStatus` for poll and Dropzone |
| 8 | "Status change fails" test row asserted nothing extra (blind) | low | patch | Asserts stored with `replace: true` and `markReceived` called |
| 9 | Dropzone interaction (focus return, alert/status regions, drag, keyboard) untested (verification-gap, intent) | maybe-false | defer | Needs the DOM harness (epic 4) |
| 10 | Macro and upload racing: the loser's store is refused → 500 although accepted (blind, edge) | low | reject | Needs both channels within the same second for one user; the next poll shows `received` |
| 11 | "maksimal 4 MB" vs 4 MiB limit (blind) | low | reject | Limit is slightly above the stated value; no file under 4 MB is refused |
| 12 | Two Supabase clients per upload; message-test titles; unused `UploadMessage` type (blind) | low | reject | Cosmetic |
| 13 | Owner check lives only in `service-ports.ts` (implementer note) | low | reject | Both submission routes go through it; macro has no session and is fenced by the token |

## Design Notes

- Token, not `attemptId`: matching the screen's id first would turn graded or abandoned files into `NOT_THIS_ATTEMPT`, while Done when 3 wants each its own message. One attempt in progress per user (AD-5) means an accepted file always belongs to the attempt on screen, except a screen stale ≤ 2 s after Abandon on another device; its next poll then shows its own status.
- Service role after the session check (user, 2.5 review; AD-9): the session gets no write access to attempt status or submitted files. `service-ports.ts` builds the same ports as the macro and, for upload, treats an attempt whose `user_id` is not the session user's as not found (`NOT_THIS_ATTEMPT`). Core stays the one decider of transitions (AD-5).
- `accept=".xlsm,.xlsx"` follows EXPERIENCE.md › Upload Dropzone: a Save-As `.xlsx` copy can be picked and gets the identity message instead of being filtered silently.
- Raw body like macro: the same `readBoundedBody` applies; `fetch` has no upload progress, so the bar is indeterminate (files ≤ 4 MiB).
- No DOM harness (epic 4): client logic lives in `upload.ts`; drag, focus and the transition are manual checks.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: clean; CI job `db-contract` green.

**Manual checks (if no CLI):**
- Preview (`dev`): Start → upload the real file via `Tab`/`Enter` → "File received — grading…"; old file, `.xlsx`, PDF, an abandoned attempt's file → each its own message; drag-over and drop; NVDA reads "Uploading…" and the rejection.
