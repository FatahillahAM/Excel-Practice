---
title: 'Tracer: L01-P1 dinilai, Results muncul sendiri di Production'
type: 'feature'
ticket: '1'
created: '2026-11-09'
status: 'in-progress'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
baseline_revision: 'be7fbf9b616662ae72914bb125b895f41dc4a088'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** File yang diterima berhenti di `received`: belum ada `grade()`, kontrak `Result`, kolom hasil, maupun halaman Results, jadi Finish pada L01-P1 tidak pernah memberi skor (CAP-5, B1) dan epic 4 tidak punya `Result` tersimpan untuk dibaca.

**Approach:** Core mendapat kontrak `Result` lengkap, tipe port `WorkbookReading`, dan `grade(snapshot, reading, hintsUsed)` dengan dua pemeriksa pertama (`formula_present`, `value_equals_key`) serta use case `gradeAttempt` yang memutuskan `grade_ok`/`grade_error`. Route macro dan upload menjadwalkan penilaian di `after()` setelah file diterima; service role menulis `status` + `result` dalam satu compare-and-set dari `received`. Endpoint status mengembalikan `resultId` (= id percobaan) dan layar exam berpindah sendiri ke `/results/<attemptId>` yang menampilkan skor /100 dan "x of y correct".

## Boundaries & Constraints

**Always:**
- `grade()` murni dan deterministik (AD-1, AD-3): hanya snapshot + `WorkbookReading` + `hintsUsed`; tanpa jam, acak, IO, atau membaca ulang konten. Skor = Σ poin soal benar − 5 × `hintsUsed`, minimal 0.
- `Result` divalidasi zod sebelum ditulis dan saat dibaca; per soal: `number`, `points`, `pointsAwarded`, `correct`, `reasonText` (null bila benar), `tip` (null sampai entry 4).
- `reasonText` dari templat Indonesia per pemeriksa di `src/core/grading` (U2), tanpa membocorkan kunci; core tidak mengimpor `src/messages`.
- Tulisan `graded`/`grading_failed` hanya lewat `transition()` (AD-5) dan satu UPDATE `where id = ? and status = 'received'` (U1); sesi tidak mendapat izin tulis atas `result`.
- Macro dan upload memakai satu fungsi penjadwal penilaian yang sama (paritas).

**Never:**
- `not_hard_coded`, `uses_functions`, `uses_reference`, fixture Excel emas, tes paritas skor (entry 2); trigger pagar AD-5, Try again, penilaian ulang setelah 15 s di endpoint status (U4), harness DOM (entry 3); hint dan Tip konten (entry 4–5); isi penuh Results (entry 6); History (entry 8).
- Kunci, token, atau byte file di log atau di `Result`; tabel `results` terpisah.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Semua benar | L01-P1 Finish, rumus benar di semua sel jawaban | `graded`, `result.score` 100, 4 of 4 correct; layar exam ke `/results/<id>` | — |
| Angka diketik | satu rentang berisi nilai tanpa rumus | soal itu salah, `reasonText` templat `formula_present`, poin 0 | — |
| Nilai salah / kosong | hasil lain, sel kosong, atau rumus belum dihitung (`null`) | soal salah, templat `value_equals_key` / sel kosong | alasan lebih rinci di entry 2 |
| Snapshot tidak valid | percobaan tracer (`snapshot` null) atau gagal `examSnapshotSchema` | `grading_failed`, log `grading.snapshot_invalid` | percobaan bisa di-Abandon |
| File tak terbaca / bug | `submission-1.xlsm` hilang, `readWorkbook` atau `grade()` melempar | `grading_failed`, log `grading.file_unreadable` / `grading.grade_threw` | idem |
| DB tak menjawab | baca/tulis gagal | tidak ada tulisan, tetap `received`, log `grading.*_failed` | dipulihkan U4 (entry 3) |
| CAS kalah | Abandon saat penilaian berjalan | hasil dibuang, log `grading.lost` | — |
| Duplikat | Finish kedua saat `received` | tidak menjadwalkan penilaian lagi | — |
| Status | `graded` dengan `result` | `resultId` = id percobaan; selain itu `null` | — |
| Results orang lain / tanpa `result` | id percobaan user lain, atau baris `graded` lama dari SQL 2.12 | 404 (`notFound`) | — |

</frozen-after-approval>

## Code Map

- `src/core/content/{checks,level-module,a1}.ts` -- `checkSchema`, `KEY_TOLERANCE`, `ExamSnapshot`/`examSnapshotSchema` (strict, no tip yet), `expandRange`.
- `src/core/submission/submit.ts` -- ports pattern (`PortRead`), `SubmitResult.log.received` tells a fresh accept.
- `src/adapters/workbook/read.ts` -- `readWorkbook` → `WorkbookReading` (formula text, cached value, type per cell); says the type moves to core with grading.
- `src/adapters/supabase/attempts.ts` -- `changeStatus` (the one CAS writer), `ATTEMPT_COLUMNS`, `storeSubmissionFile`, `submissionFilePath`.
- `src/app/api/submissions/{http,service-ports}.ts`, `{macro,upload}/route.ts` -- shared envelope; service-role client per request.
- `src/app/api/attempts/[attemptId]/status/route.ts` -- `resultId: null` today.
- `src/app/(app)/exam/[attemptId]/{page,exam-status}.tsx` -- server render + 2 s poll; `graded` shows "File received — grading…".
- `supabase/migrations/20261104000001_attempts_snapshot.sql` -- column-level select for `authenticated`; new columns need an explicit grant.

## Tasks & Acceptance

**Execution:**
- [x] `src/core/grading/workbook-reading.ts` -- move `CellType`, `CellReading`, `WorkbookReading` here (`vbaModuleHashes: Readonly<Record<string,string>> | null`); `src/adapters/workbook/read.ts` imports and re-exports them.
- [x] `src/core/grading/result.ts` (+test) -- `Tip {id, title, body, shortcuts}` + `tipSchema`; `QuestionResult`, `Result {version: 1, contentVersion, scenarioId, hintsUsed, hintPenalty, pointsEarned, score, correctCount, questionCount, questions}` + strict `resultSchema` (score = max(0, pointsEarned − hintPenalty), counts consistent).
- [x] `src/core/grading/checkers.ts` + `reasons.ts` (+tests) -- registry `name → (question, cells) → {ok} | {ok:false, reason}`; `formula_present` (every cell has a formula), `value_equals_key` (number within `tolerance × max(1,|key|)`, text exact, `null`/type mismatch wrong); reason templates "Sel {ref} berisi angka yang diketik, bukan rumus.", "Sel {ref} masih kosong.", "Hasil di {ref} belum sesuai." Checks not in the registry are skipped.
- [x] `src/core/grading/grade.ts` (+test) -- `grade(snapshot, reading, hintsUsed): Result`; checks in declared order, first failing check and cell gives `reasonText`; copies `question.tip ?? null`; output passes `resultSchema`.
- [x] `src/core/grading/grade-attempt.ts` + `index.ts` (+test) -- `gradeAttempt(attemptId, ports, {hintsUsed: 0})` with ports `load`, `readSubmission`, `readWorkbook`, `complete(event, result|null)`; decides per matrix; returns `{outcome, log}` (`graded | grading_failed | skipped | lost | failed`).
- [x] `supabase/migrations/20261109000001_attempts_result.sql` + `contract.db.test.ts` -- `result jsonb` (object), `check (result is null or status = 'graded')`, `check (status <> 'graded' or result is not null) not valid`; `grant update (result)` to `service_role`; `grant select (result)` to `authenticated` (no insert/update); set-once trigger; bump `schema_version`. Tests: session update of `result` refused (42501), session reads own `result`, service CAS writes it, second write refused.
- [x] `src/adapters/supabase/attempts.ts` (+test) -- `changeStatus` takes optional `{ result }` written in the same UPDATE; `loadForGrading` (service: status, snapshot), `downloadSubmissionFile` (service), `readResult` (session, RLS).
- [x] `src/app/api/submissions/grading.ts` (+test) -- service-role grading ports and `scheduleGrading(channel, attemptId)` = `after(() => gradeAttempt(…))` from `next/server`, one JSON log line (`grading.done` with `attemptId`, `channel`, `outcome`, `score`); catches everything.
- [x] `src/app/api/submissions/{macro,upload}/route.ts` (+tests) -- call `scheduleGrading` only when `result.ok && result.log.received`; tests mock `after` and assert both channels schedule once, duplicates and rejections never.
- [x] `src/app/api/attempts/[attemptId]/status/route.ts` (+test) -- `resultId` = id when `graded` and `readResult` finds a `result`.
- [x] `src/app/(app)/exam/[attemptId]/{exam-status.tsx,page.tsx}` (+tests) -- poll sees `graded` + `resultId` → `router.replace('/results/<id>')`; server render of a graded attempt with a result redirects; pure `resultPath(body)` helper tested.
- [x] `src/app/(app)/results/[attemptId]/page.tsx` (+test) -- session, `readResult`, `resultSchema.safeParse`; `<h1>` "Results", item label, "N/100", "x of y correct"; missing → `notFound()`, invalid → logged load-failed card.

**Acceptance Criteria:**
- Given Production on the laptop, when Finish is clicked on L01-P1, then within a few polls the exam screen moves itself to `/results/<attemptId>` showing the score /100 and "x of y correct", and `attempts.result` holds the matching `Result`.
- Given `npm run test`, when core grading tests run, then synthetic readings for every matrix row give the expected `Result`, and macro and upload schedule grading through the same function.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).

## Plan Change Log

## Review Triage Log

## Design Notes

- [ASSUMPTION] Session may `select (result)`: it has points, reasons and Tips, never the key or expected values; Results (and History, entry 8) render it through the session (AD-9). Only the service role writes it.
- [ASSUMPTION] `check … not valid` keeps the 2.12 SQL-graded rows legal (U6) while every new `graded` row needs a `result`.
- [ASSUMPTION] Unimplemented checkers are skipped in 3.1, so tracer scores are lenient (typed values fail `formula_present`; wrong functions pass); `Result.version` lets later entries tell them apart. Entry 2 fills the registry.
- [ASSUMPTION] `tip` is null until entry 4; entry 4's content Tip reuses `tipSchema` and adds `tip` to `examQuestionSchema`. `hintsUsed` is 0 until entry 5.
- [ASSUMPTION] A DB fault leaves the attempt `received` (not `grading_failed`), and nothing restarts it in 3.1; U4 (entry 3) does.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: clean (ESLint AD-1 rule passes for `src/core/grading`).
- `npm run test:db` (CI `db-contract`) -- expected: green with the result migration.

**Manual checks (if no CLI):**
- Preview (`dev`), then Production: Start L01-P1, type the expected formulas, Finish → exam screen moves to Results with 100/100 and "4 of 4 correct"; a second attempt with typed numbers in one range → lower score; reload of `/exam/<id>` after grading redirects to Results; migration applied `dev` then `prod` (AD-13).
