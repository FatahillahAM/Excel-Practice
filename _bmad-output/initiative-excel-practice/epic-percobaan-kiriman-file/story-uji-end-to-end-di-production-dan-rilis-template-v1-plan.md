---
title: 'Uji end-to-end di Production dan rilis template v1'
type: 'feature'
ticket: '12'
created: '2026-11-09'
status: done
route: 'full'
route_source: 'auto'
review: 'none'
review_source: 'auto'
lenses_ran: []
review_loop_iteration: 0
baseline_revision: 'b0ad43f09c1ce6b7eb0aa238bc4cf4235a5f11c0'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Done when 1–5 epic sejauh ini terbukti sebagian di Preview (2.9, 2.10) dan sebagian di Production (tracer 2.1, Finish `eb824d75`), belum pernah semuanya di Production lewat macro dan upload; template v1 juga belum ditandai rilis, sehingga tidak ada yang mencegah v1 diubah di tempat lagi (B7, `deferred-work.md`).

**Approach:** User menjalankan checklist Production di laptop dan PC kantor (macro diblokir), satu baris per Done when; orchestrator mengambil log runtime Production dan baris DB sebagai bukti dalam satu jam setelah tiap langkah. Setelah semua lulus, agent menandai v1 rilis di registry (`released` + SHA-256 file yang dikunci tes), lalu mencatat bukti di plan ini dan Notes epic.

## Boundaries & Constraints

**Always:**
- Bukti hanya dari Production (`excel-practice-omega.vercel.app`, Supabase `prod`): baris log JSON dari route (`attempt.started`, log kiriman `{attemptId, channel, code, received, duplicate}`, `attempt.abandoned`) dan baris `attempts` (`status`, `started_at`, `received_at`). Log hanya memuat `tokenSha256` 12 hex, tidak pernah token.
- Vercel Hobby menyimpan log runtime 1 jam: orchestrator membaca log setelah setiap langkah user dan langsung menyalinnya ke Implementation Notes.
- Status `graded` hanya diset orchestrator lewat SQL di `prod`, atas permintaan user, untuk satu percobaan uji (Touch point epic: ALREADY_GRADED diuji di entry 12).
- Rilis v1 = metadata registry saja: byte `exam.v1.xlsm`, sidik jari `modFinish`, dan perilaku route tidak berubah. Versi rilis tidak pernah diubah; perubahan berikutnya = `exam.v2.xlsm` (spine AD-4).
- Akhir checklist: tidak ada percobaan terbuka di `prod`.

**Never:**
- Mengubah `modFinish.bas`, template, `submit()`, route, atau migrasi; menambah v2.
- Menandai epic `done` (keputusan user); mengubah status percobaan lain lewat SQL selain yang diminta.
- Mematikan proteksi atau mengubah setting Vercel/Supabase Production.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Start + unduh ulang | laptop, tanpa percobaan terbuka | `.xlsm` dengan Instructions + data baru; SHA-256 dua unduhan sama; `started_at` tidak berubah | gagal → langkah berhenti, log `attempt.*_failed` dicatat |
| Finish | file dari Trusted Location | terkirim, workbook tertutup, layar → "File received — grading…" | gagal → upload, catat sebagai gagal DW2 |
| Upload valid | PC kantor, macro diblokir | layar → "File received — grading…" sama seperti macro | — |
| File lama | file dari Preview/dev atau `spike-s1` (token tak ada di `prod`) | `NOT_THIS_ATTEMPT`, percobaan tetap terbuka | — |
| Save As `.xlsx` | salinan `.xlsx` dari file percobaan | upload → `IDENTITY_ALTERED` (macro tak mungkin berjalan di `.xlsx`) | — |
| Kode VBA tambahan | baris kode di `Sheet1 (Instructions)` | macro → `IDENTITY_ALTERED`, workbook tetap terbuka | — |
| Sudah dinilai | `eb824d75` diset `graded` lewat SQL | macro dan upload → `ALREADY_GRADED` | — |
| Dibatalkan | percobaan di-Abandon | macro dan upload → `ATTEMPT_CLOSED` | — |
| Satu terbuka | percobaan `open`/`received` | Start terkunci di /levels kedua perangkat; Resume membuka layar yang sama | — |
| Log hilang | langkah dilaporkan > 1 jam kemudian | bukti dari baris `attempts` + message box/teks layar yang ditempel user | ulangi langkah bila keduanya tidak cukup |

</frozen-after-approval>

## Code Map

- `src/adapters/workbook/templates.ts` (+`templates.test.ts`) -- registry AD-4; `TemplateInfo` gets the release marker; the test already recomputes the fingerprint from the committed file.
- `assets/templates/README.md` -- rebuild procedure ("Mengganti `modFinish`"); must say v1 is released and changes go to v2.
- Log sources: `src/app/api/submissions/http.ts` (one line per submission), `src/app/(app)/levels/start-actions.ts` (`attempt.started`), `src/app/(app)/dashboard/abandon-actions.ts` (`attempt.abandoned`).
- `supabase/migrations/20261102000001_attempts.sql` -- one-in-progress index; `graded` needs `received_at` (set for `eb824d75`).
- `scripts/spike-s1.ts` -- default `--server-url` is Production: makes the macro "file lama" (unknown token).
- `epic-percobaan-kiriman-file.md` › Notes; `_bmad-output/implementation-artifacts/deferred-work.md` (B7 item, "moved — story 2.12").

## Tasks & Acceptance

**Before the run (agent):**
- [x] Confirm Production serves `main` with 2.9–2.11 and that `assets/templates/exam.v1.xlsm` is unchanged between the deployed commit and HEAD (`git log -- assets/templates/exam.v1.xlsm`).
- [x] `node scripts/spike-s1.ts` → send the user the file (unknown token, `WHE_ServerUrl` = Production).

**Production checklist (user, hitl).** After each step, tell the orchestrator; it reads Vercel runtime logs within the hour and the `prod` row, and records them.

| # | Done when | Device / steps | Evidence the orchestrator records |
|---|-----------|----------------|-----------------------------------|
| 1 | DW3 sudah dinilai | Ask the orchestrator to set `eb824d75` to `graded` (SQL, `where status = 'received'`). Laptop: open its file, **Finish** → "File ini sudah dinilai…". PC kantor: upload the same file (copied by USB/email) → same message inline. | row `graded`; logs `code: ALREADY_GRADED`, `channel` macro and upload, `attemptId` eb824d75 |
| 2 | DW1, DW5 | Laptop: Start L1 P1 (attempt A); browser saves to `C:\ExcelPractice`; Excel opens it without the red bar, Instructions and data filled. **Download again** on the exam screen; PowerShell `Get-FileHash` on both files. | `attempt.started` (A); equal hashes pasted; `started_at` same before/after |
| 3 | DW3 kode VBA, DW2 macro | Laptop: in A add `Sub X()`/`End Sub` to `Sheet1 (Instructions)`, **Finish** → "Identitas file ini rusak…"; remove it, **Finish** → sent, workbook closes, screen moves by itself. | logs `IDENTITY_ALTERED` macro, then `received: true` macro; row `received` |
| 4 | DW4 PC kantor | PC kantor: Dashboard shows A's Attempt Card, Start locked on /levels, **Resume** opens A's exam screen; **Abandon** A. | `attempt.abandoned` (A); row `abandoned` |
| 5 | DW3 dibatalkan | Laptop: open A's file, **Finish** → "Percobaan ini sudah ditutup…". PC kantor: upload A's file → same message. | `ATTEMPT_CLOSED` macro and upload, `attemptId` A |
| 6 | DW3 file lama | Laptop: open the `spike-s1` file, **Finish** → "File ini bukan dari percobaan…". PC kantor: upload a Preview file from 2.9/2.10 → same message. | `NOT_THIS_ATTEMPT` macro and upload, `attemptId` null |
| 7 | DW2 upload, DW3 `.xlsx`, DW4 laptop | PC kantor: Start (attempt B), open (macros blocked), type a value, Save; **Save As** `.xlsx` copy → upload → "identitas…" message; upload the `.xlsm` → "File received — grading…". Laptop: Dashboard **Resume** B, Start locked; **Abandon** B. | `attempt.started` (B); `IDENTITY_ALTERED` upload; `received: true` upload; `attempt.abandoned` (B); no open attempt left |

DW6 = rows 1–7 all on Production. Paste every message box / inline message into chat.

**After the run (agent):**
- [x] `src/adapters/workbook/templates.ts` -- add optional `released?: { on: string; fileSha256: string }` to `TemplateInfo`; v1 gets the run's date and the SHA-256 of the committed `exam.v1.xlsm`; doc comment: a released entry is never edited, a change is a new version registered before it becomes current (AD-4).
- [x] `src/adapters/workbook/templates.test.ts` -- for each released template, the committed file's SHA-256 equals `released.fileSha256` (failure message: "released — ship exam.v<N+1>.xlsm"); `on` is an ISO date; v1 is released.
- [x] `assets/templates/README.md` -- under "Mengganti `modFinish`": v1 dirilis <tanggal>; procedure now produces `exam.v2.xlsm` + registry entry, never edits v1.
- [x] `deferred-work.md` -- B7 item → closed (2.12).
- [x] Epic Notes -- one `Decision:` line: 2.12 passed DW1–6 on Production (attempt prefixes, log times), v1 released (date, file SHA-256 prefix, `modFinish` 0067736c…). Epic `status` stays `in-progress`; `done` is the user's call.

**Acceptance Criteria:**
- Given rows 1–7 done, then each Done when has at least one Production log line or `prod` row recorded in Implementation Notes, and no attempt is open in `prod`.
- Given any later edit of `exam.v1.xlsm`, when CI runs, then `templates.test.ts` fails with the "ship v2" message.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Production run 2026-11-09 (all times UTC) on deployment `dpl_4qx37LDsNZe7re3tgrYAwt9KWY6e` (`main`, PR #13 merge `273da77`). `git diff 273da77 HEAD -- assets/templates/exam.v1.xlsm` is empty: the released file is the one tested. Evidence copied from Vercel runtime logs (within the 1 h retention) and `prod` rows by the orchestrator.

| # | Done when | Evidence (time · channel · event/code · attempt) | Deviation |
|---|-----------|--------------------------------------------------|-----------|
| pre | — | 01:53:58 · macro · `received` · `eb824d75` (roti-mentari), Finish on rebuilt v1 before the run | — |
| 1 | DW3 sudah dinilai | 02:01:12 · macro · `ALREADY_GRADED` · `eb824d75` (`tokenSha256` 55b0f07b3b82), row set `graded` via SQL. 02:30:35 · upload · `ALREADY_GRADED` · `bcb40c19` | Upload half used attempt B (`bcb40c19`, kopi-bukit-hijau) set to `graded` via SQL at the user's request, because the roti-mentari file was not on the office PC. |
| 2 | DW1, DW5 | 02:01:57 · `attempt.started` · `a78e00b8` (A, kabel-arus-prima). 02:10:32 · `attempt.started` · `bd3bdc8c` (C, furnitur-jati-makmur). Download again of C, PowerShell `Get-FileHash` on both files before opening: both `F1AA2C9477C4E2DCB0B9FAA34D56B88628FF3833B20EE08A7127256C91F8C6EE` | Hash check ran on attempt C (A was used up by row 3's first try). |
| 3 | DW3 kode VBA, DW2 macro | 02:13:48 · macro · `IDENTITY_ALTERED` · `bd3bdc8c` (added code). 02:14:08 · macro · `received: true` · `bd3bdc8c` (code removed). 02:14:28 · macro · `duplicate: true` · `bd3bdc8c` (second Finish of the same file) | First try on A (02:05:23 · macro · `received` · `a78e00b8`) was sent without the added-code step (user had trouble adding `Sub X`); A abandoned 02:06:24 and the row redone on C. |
| 4 | DW4 PC kantor | 02:14:48 · `attempt.abandoned` · `bd3bdc8c` (Dashboard); also `a78e00b8` 02:06:24 | — |
| 5 | DW3 dibatalkan | 02:14:59 · macro · `ATTEMPT_CLOSED` · `bd3bdc8c`. 02:27:20 · upload · `ATTEMPT_CLOSED` · `bd3bdc8c` (file C) | Ran on C instead of A. |
| 6 | DW3 file lama | 02:23:07 · macro · `NOT_THIS_ATTEMPT` · `tokenSha256` 9906a4f9bf9b (`spike-s1-hGezsRAz.xlsm`). 02:27:04 · upload · `NOT_THIS_ATTEMPT` · same `tokenSha256` 9906a4f9bf9b | Upload used the same `spike-s1` file as the laptop, not a Preview file; the token is unknown in `prod` either way. |
| 7 | DW2 upload, DW3 `.xlsx`, DW4 laptop | 02:22:16 · `attempt.started` · `bcb40c19` (B, office PC). 02:23:51 · upload · `IDENTITY_ALTERED` (Save As `.xlsx`). 02:24:10 · upload · `received: true` · `bcb40c19`. 02:24:41 · `attempt.abandoned` · `bcb40c19` (Dashboard) | Extra attempt D `3ae91bb7` (keramik-tanah-liat) started 02:26:48 on the office PC for the upload checks of rows 5–6, abandoned 02:30:44. |
| DW6 | all rows on Production | Every line above is from `excel-practice-omega.vercel.app` / Supabase `prod`. After 02:30:44 no `open`, `received` or `grading_failed` attempt left in `prod`. | — |

- Release (agent, after the run): `templates.ts` `TemplateInfo.released?: { on, fileSha256 }`; v1 `released: { on: "2026-11-09", fileSha256: "aa2b82e2a5b12da15b80848c8ad8fa32b5dd83e9f4757ba5f5059382289cc42f" }` (`sha256sum` of the committed `assets/templates/exam.v1.xlsm`). `templates.test.ts` "released templates": v1 is released, `on` is a real ISO date, and the committed file's SHA-256 equals `fileSha256` (message "… is released — ship exam.v2.xlsm"). README, `deferred-work.md` B7 and one epic `Decision:` line updated; epic stays `in-progress`.

## Plan Change Log

## Review Triage Log

No lens run: the code change is one optional registry field, its value and one test (verified by mutating the pinned hash, which failed with the "ship exam.v2.xlsm" message); the rest is evidence and docs. The orchestrator confirmed on prod at 02:31Z that no open/received/grading_failed attempt is left.

## Design Notes

- Prior evidence (2.1 and 2.8 on Production; 2.5, 2.9, 2.10 on Preview; `eb824d75` Finish on Production at 2026-11-09T01:53:58Z, log past retention) is background only: Verify asks for Production logs, so every Done when is rerun.
- Release marker: the spine only says a released version "is never modified" and the existing test recomputes the fingerprint, which a rebuild plus registry edit would silently pass. Pinning the whole file's SHA-256 is the smallest check that makes "never modified" fail in CI (cells, button, VBA alike). No spine change: AD-4 already states the rule.
- [ASSUMPTION] `eb824d75` is used for "sudah dinilai" instead of being abandoned: it is already `received` from the rebuilt v1, and `graded` frees the Start lock.
- [ASSUMPTION] Release is recorded after the run, in the same PR; the run's attempts are tests, not the "first real attempt" B7 guards, and the bytes are unchanged, so the released file is exactly the one tested.
- [ASSUMPTION] "File lama" = a file whose token is not in `prod` (spike file for macro, Preview file for upload); a file from an abandoned `prod` attempt is the "dibatalkan" row.
- [ASSUMPTION] `.xlsx` is upload-only: a `.xlsx` carries no macro, so there is no Finish to press; macro `IDENTITY_ALTERED` is shown with added VBA code (row 3).
- [ASSUMPTION] The user moves `eb824d75`'s and A's files to the office PC by USB or email; if impossible, the upload half of rows 1 and 5 may run from the laptop browser (channel is what matters).

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: clean.
- Supabase `execute_sql` on `prod`: `select status, count(*) from attempts where status in ('open','received','grading_failed') group by 1` -- expected: no rows.

**Manual checks:**
- Implementation Notes: per checklist row, log line(s) with timestamp, event/code, channel, attempt prefix.
