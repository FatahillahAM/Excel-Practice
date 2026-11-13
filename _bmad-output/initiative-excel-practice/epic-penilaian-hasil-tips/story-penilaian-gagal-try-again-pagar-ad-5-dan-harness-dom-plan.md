---
title: 'Penilaian gagal, Try again, pagar AD-5, dan harness DOM'
type: 'feature'
ticket: '3'
created: '2026-11-10'
status: 'built'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: 'bb796dc0d189ce42618c2947b9079df4b60ca45c'
context: ['{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Database belum memagari tulisan `attempts.status` terhadap diagram AD-5 (service role dan superuser bisa menulis transisi apa pun; hanya mesin TS yang menjaga), percobaan `grading_failed` tidak punya jalan keluar selain Abandon, dan percobaan yang macet di `received` (mis. `after()` terhenti, gangguan Storage/DB) tidak pernah dinilai ulang (B1, B2, B3, U4). Layar exam juga belum punya tes DOM, jadi efek poll → Results hanya diuji lewat fungsi murni (U8).

**Approach:** Satu migrasi baru memasang trigger pagar AD-5 untuk semua role, kolom `grading_requested_at` yang di-stamp database setiap kali percobaan masuk `received`, dan RPC `claim_grading_restart` (klaim sekali per 15 s). Server Action Try again memindahkan `grading_failed → received` lewat service role setelah sesi dan kepemilikan dicek, lalu menjadwalkan penilaian di `after()`; endpoint status menjadwalkan ulang penilaian bila klaim 15 s berhasil. Layar exam menampilkan pesan destruktif + tombol "Try again", dan harness DOM (jsdom + testing-library, environment per file) membuktikan poll → Results serta alur gagal → Try again → `graded`.

## Boundaries & Constraints

**Always:**
- Pagar berlaku untuk setiap role (`authenticated`, `service_role`, superuser): hanya 8 sisi diagram AD-5 (= tabel `transition()` di `src/core/services/attempts/lifecycle.ts`); `insert` hanya boleh `status = 'open'`. Update yang tidak mengubah status tidak dihalangi. Penolakan: SQLSTATE `23514`, constraint `attempts_status_ad5`.
- `received_at` tetap waktu file pertama diterima (AD-8: durasi dan rekor); Try again tidak mengubahnya. Waktu "di `received`" untuk U4 dibaca dari `grading_requested_at`, di-stamp database (`now()`), tidak pernah dari nilai yang dikirim aplikasi.
- Penilaian ulang U4: paling banyak satu penjadwalan per percobaan per 15 s, ditentukan oleh UPDATE atomik di database (bukan jam server app); penulis hasil tetap satu lewat compare-and-set `status = 'received'`. Pemenang klaim yang menjadwalkan; yang kalah tidak.
- Try again: Server Action dengan cek sesi; kepemilikan lewat bacaan sesi (RLS); tulisan status lewat `changeStatus(service, id, 'grading_failed', 'retry_grading')` (sesi tidak punya izin, AD-9); penjadwalan lewat `scheduleGrading` yang sama dengan macro/upload.
- CAS yang kembali `lost` (Abandon menang) dicatat `grading.lost` (info) dan hasilnya dibuang, tanpa tulisan apa pun.
- Pesan Indonesia di `src/messages/id.ts`, verbatim dari EXPERIENCE.md › Message set; pesan gagal di `role="alert"` `lang="id"` warna `destructive`.
- Migrasi diterapkan ke `dev` lalu `prod` oleh orchestrator sebelum kode di-deploy (AD-13), bukan oleh implementer.
- Dependensi harness dipin versi persis (tanpa `^`), dirilis ≥ 2 minggu sebelum 2026-11-10; environment jsdom dipilih per file, default tetap `node`.

**Never:**
- Hint, Tip konten, snapshot v2 (3.4–3.5); isi Results (3.6); harness untuk Orbit toggle, Upload Dropzone, dialog Abandon, Settings, auto-download (epic 4 memakai harness ini).
- Job terjadwal; penilaian ulang dari `grading_failed` tanpa klik user; lebih dari 3 penilaian ulang otomatis berturut-turut (setelah itu `grading_failed`; keputusan user 2026-11-13).
- Mengubah migrasi lama, `received_at`, atau constraint `attempts_result_only_when_graded`; memberi sesi izin tulis atas `status` selain Abandon.
- Tes yang di-skip atau ditunda.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sisi AD-5 sah | service role: `received → graded` (+result), `grading_failed → received`, dst. | berhasil; `grading_requested_at = now()` saat masuk `received` | — |
| Di luar diagram | role apa pun: `graded → open`, `abandoned → received`, `graded → closed`, `open → graded` | ditolak 23514 `attempts_status_ad5`, baris tidak berubah | adapter: `failed` + log kode |
| Insert bukan `open` | superuser `insert … status 'graded'` | ditolak 23514 | — |
| Penilaian gagal | `grading_failed` (poll atau render server) | "Penilaian gagal. Coba lagi, ya — file kamu aman." (alert) + Primary Button "Try again"; Orbit berhenti; poll lanjut | — |
| Try again | klik di `grading_failed` milik sendiri | `received`, penilaian dijadwalkan (`channel: retry`), pesan lambat dihitung dari 0; lalu `graded` → Results | — |
| Try again kalah | status sudah berubah (perangkat lain, Abandon) | tidak menulis apa pun; layar mengikuti poll berikutnya | — |
| Try again gagal | DB/env service tak tersedia | "Koneksi lagi bermasalah. Coba lagi sebentar, ya." di alert; tombol aktif lagi | log `attempt.retry_grading_failed` |
| Try again tanpa sesi / bukan pemilik | sesi habis / id orang lain atau rusak | Login lalu kembali ke `/exam/<id>` / error tanpa info | — |
| Macet di `received` | poll saat `grading_requested_at` ≥ 15 s lalu | klaim menang → satu penilaian dijadwalkan (`channel: restart`), stamp diperbarui | klaim gagal/DB error: respons status tetap 200 |
| Poll beruntun | dua poll dalam 15 s setelah klaim | hanya klaim pertama menjadwalkan | — |
| Abandon saat menilai | Abandon lalu CAS grader | `lost`, hasil dibuang, status `abandoned` | log info `grading.lost` |
| Baris lama | `received`/`grading_failed` sebelum migrasi; `graded` tanpa result (2.12) | backfill `grading_requested_at = received_at`; baris `graded` tidak disentuh | — |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261102000001_attempts.sql` -- `attempts_stamp_received_at` (before update of status; keeps `received_at` on every other change); column-level grants; `grant update (status)` to `service_role`.
- `supabase/migrations/20261103000001_attempts_abandon.sql` -- session update policy: `using` open/received/grading_failed, `with check` abandoned. A BEFORE trigger fires before RLS `with check`, so the fence's 23514 can come before 42501.
- `supabase/migrations/20261109000001_attempts_result.sql` -- latest; pattern for comments, `set search_path = ''`, `revoke execute … from public, anon, authenticated`, `schema_version` bump. `attempts_graded_has_result` is `not valid`: Postgres re-checks it on any UPDATE of a legacy `graded` row, so the backfill must skip `graded` rows.
- `supabase/tests/contract.db.test.ts` -- helpers `as`, `asUser`, `asService`, `attemptIn` (moves along AD-5 as superuser), `expectSqlError(code, constraint)`. Tests that change: `:391` "stays when a graded attempt later moves to closed" (now refused by the fence); `:509-518` session `open → graded|grading_failed` (now 23514; `received`, `closed`, `open` stay 42501).
- `src/adapters/supabase/migrations.test.ts` -- requires each migration to set its own `schema_version`.
- `src/core/services/attempts/lifecycle.ts` -- the 8 edges; unchanged, the fence mirrors it.
- `src/adapters/supabase/attempts.ts` -- `ATTEMPT_COLUMNS`, `Attempt`, `toAttempt`, `readAttempt`, `changeStatus` (one CAS writer), `isAttemptId`, `logError`. Reuse; add `claimGradingRestart`.
- `src/core/grading/grade-attempt.ts` -- `lost` already returned and nothing written; `failed` leaves `received` (what U4 restarts).
- `src/app/api/submissions/grading.ts` -- `runGrading(channel, id)`, `scheduleGrading(channel, id)` = `after(...)`; `grading.lost` info log already present. `ChannelKind` from `./http` (`macro | upload`).
- `src/app/api/attempts/[attemptId]/status/route.ts` (+`route.test.ts`) -- session read, `hasValidResult`; add the restart.
- `src/app/(app)/exam/[attemptId]/exam-status.tsx` -- `POLLED`, `statusLine`, `applyStatus`/`receivedAnchorOnChange` (grading_failed → received counts from 0), poll effect with `leaving` + `router.replace`; Orbit shown for every `POLLED` status.
- `src/app/(app)/exam/[attemptId]/page.tsx` -- `initialReceivedSeconds` from `receivedAt`.
- `src/app/(app)/dashboard/abandon-actions.ts` + `abandon-button.tsx` -- Server Action and `useActionState` pattern to copy (redirect outside try, `unstable_rethrow`).
- `src/app/(app)/levels/start-control.tsx:62-67` -- Primary Button classes to reuse.
- `src/hooks/use-motion-preference.ts` -- calls `window.matchMedia` (absent in jsdom: stub in the harness).
- `src/app/(app)/exam/[attemptId]/page.test.tsx` -- `vi.hoisted` + `vi.mock("next/navigation")` pattern.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261110000001_attempts_status_fence.sql` -- (1) `grading_requested_at timestamptz` (nullable); backfill `= received_at` where `status in ('received','grading_failed')`; `grant select (grading_requested_at)` to `authenticated`; no update grant to anyone. (2) Replace `attempts_stamp_received_at()` (same trigger) so that on `open → received` and `grading_failed → received` it sets `new.grading_requested_at := now()`, else keeps the old value; `received_at` behaviour unchanged. (3) `attempts_status_fence()` + triggers `before insert` (status must be `open`) and `before update of status` (if changed, `(old,new)` must be one of the 8 edges) raising `check_violation` with `constraint = 'attempts_status_ad5'`. (4) `claim_grading_restart(p_attempt_id uuid) returns boolean`, `security definer`, `set search_path = ''`, one `update … set grading_requested_at = now() where id = p and status = 'received' and coalesce(grading_requested_at, received_at) <= now() - interval '15 seconds'`, true iff a row matched; execute revoked from public/anon/authenticated, granted to `service_role`. (5) Comment: graded → closed is outside AD-5, so the 3.1 "result stays on closed" allowance is now unreachable (constraint left as is). (6) Bump `schema_version` to `20261110000001`.
- [x] `supabase/tests/contract.db.test.ts` -- new `describe("status fence (AD-5, every role)")`: all 30 `from → to` pairs as `service_role` (result supplied for `graded`), the 8 edges succeed and the 22 others fail 23514 `attempts_status_ad5`; the same refusal as superuser (`graded → open`, `abandoned → received`) and a superuser insert with `status 'graded'`; same-status update allowed. `grading_requested_at`: stamped on open → received and on grading_failed → received (`received_at` unchanged), not writable by session or service (42501). `claim_grading_restart`: false under 15 s, true once after backdating (superuser), false on the immediate second call and for non-`received` rows; not executable by `authenticated`/`anon`. Lost: owner abandons a `received` attempt, then the service CAS `received → graded` matches 0 rows and `result` stays null. Update `:391` and `:509-518` as in the Code Map.
- [x] `src/adapters/supabase/attempts.ts` (+test) -- `gradingRequestedAt` on `Attempt` and in `ATTEMPT_COLUMNS`; `claimGradingRestart(service, id): Promise<Read<boolean>>` (rpc; `isAttemptId` guard; `attempt.claim_restart_failed` on error).
- [x] `src/app/api/submissions/grading.ts` (+test) -- `GradingSource = ChannelKind | "retry" | "restart"` for `runGrading`/`scheduleGrading`, logged as `channel`.
- [x] `src/app/api/attempts/[attemptId]/status/route.ts` (+test) -- when the read status is `received` and `elapsedSeconds(gradingRequestedAt ?? receivedAt) >= GRADING_RESTART_AFTER_S` (15): service client → `claimGradingRestart` → on `true` `scheduleGrading("restart", id)` + log `grading.restart_scheduled`. Service env missing, claim `false` or failed: no schedule, response unchanged (200). Tests: under 15 s no claim; claim true → one schedule (run the `after` callback, asserts id and `restart`); false/failed → none; `open`/`grading_failed`/`graded` → no claim.
- [x] `src/app/(app)/exam/[attemptId]/retry-actions.ts` (+`retry-actions.test.ts`) -- `"use server"` `retryGrading(prev, formData): Promise<RetryState>` with `RetryState = idle | retried | unchanged | error`: no session → `redirect(loginRedirectPath("/exam/<id>"))` outside try; bad id or `readAttempt` null → `error`; status ≠ `grading_failed` → `unchanged`; service null → `error`; `changeStatus(…, "grading_failed", "retry_grading", "attempt.retry_grading_failed")`: `changed` → `scheduleGrading("retry", id)` + log `attempt.grading_retried` → `retried`; `lost`/`refused` → `unchanged`; `failed`/throw → `error`.
- [x] `src/app/(app)/exam/[attemptId]/retry-flow.test.ts` -- forced failure end to end (mocked store, real `transition`, real `gradeAttempt`/`grade` with the L01-P1 `correct` fixture from 3.2): first run's `readWorkbook` throws → `grading_failed`; `retryGrading` → `received`; captured `after()` runs → `graded` with the expected `Result`; a second `retryGrading` → `unchanged`.
- [x] `src/messages/id.ts` -- `examMessages.gradingFailed` "Penilaian gagal. Coba lagi, ya — file kamu aman." (verbatim) and `examMessages.retryFailed` = Login "network" row verbatim (as `startFailed`).
- [x] `src/app/(app)/exam/[attemptId]/exam-status.tsx` (+`exam-status.test.ts`) -- `grading_failed`: line 1 "File received — grading failed.", no Orbit (Orbit for `open`/`received` only), alert with `gradingFailed`, Primary Button "Try again" (pending "Trying again…", disabled) in a form posting `attemptId` to `retryGrading` via `useActionState`; `retried` → `applyStatus("received")`; `error` → `retryFailed` in the alert; poll continues. `page.tsx` -- `initialReceivedSeconds` from `gradingRequestedAt ?? receivedAt`.
- [x] `package.json` + lock -- devDependencies exact: `jsdom` `29.1.1`, `@testing-library/react` `16.3.3`, `@testing-library/dom` `10.4.2`, `@testing-library/user-event` `14.6.8` (`npm i -D -E`).
- [x] `src/test/dom.ts` -- harness setup imported first by every DOM test: `afterEach(cleanup)` (Vitest globals are off), `window.matchMedia` stub when missing; header comment: `// @vitest-environment jsdom` docblock per file, `*.dom.test.tsx` naming, fake timers with `vi.advanceTimersByTimeAsync`, mock `next/navigation` (and `next/link` as `<a>` if it needs router context).
- [x] `src/app/(app)/exam/[attemptId]/exam-status.dom.test.tsx` -- mocked `fetch`, router and `./retry-actions`: (a) poll `received` then `graded` + `resultId` → `router.replace("/results/<id>")` once and no further fetch; (b) slow message appears after 15 s in `received`, not before; (c) `grading_failed` → alert + "Try again" → click (user-event) → action called with `attemptId` → status line "File received — grading…" → poll `graded` + `resultId` → replace; (d) action `error` → `retryFailed`, button enabled; (e) poll 401 → first-load message.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- 3.1 poll-effect entry: `status: done — exam-status.dom.test.tsx (3.3)`; 2.4 entry: append that the ExamStatus poll and slow-timer effects are covered by 3.3, tick and Orbit toggle stay with epic 4.

**Acceptance Criteria:**
- Given `npm run test:db`, when the fence suite runs, then every service-role and superuser update outside the AD-5 diagram is refused with `attempts_status_ad5` and the 8 edges pass.
- Given a grading run forced to fail, when "Try again" is clicked, then the attempt ends `graded` with its `Result` (retry-flow test) and the exam screen moves to Results (DOM test).
- Given `npm test`, then DOM tests run under jsdom while every other file still runs under `node`, with no skipped tests.

## Implementation Notes

- Resumed 2026-11-11 from the partial edits of 2026-11-10 after an audit of every changed file against this plan: the migration, contract tests, adapter, grading source, status route, `retryGrading` (+ tests, retry-flow), messages, `page.tsx`, `exam-status.tsx` and the pinned dependencies were kept as found (only comments touched in `exam-status.tsx`); the audit then finished `src/test/dom.ts`, wrote `exam-status.dom.test.tsx` and updated `deferred-work.md`.
- Harness, found while writing the DOM tests: (1) Testing Library drains microtasks after each user-event call with a `setTimeout(0)` that it steps itself only under Jest's fake timers; under Vitest's the call hangs, so `src/test/dom.ts` defines a `jest` global with the one method asked for (`advanceTimersByTime` → `vi.advanceTimersByTime`). (2) State set inside one `act()` re-arms effects only when it ends, so the tests advance fake time in 100 ms steps. (3) `src/test/dom.ts` also sets `IS_REACT_ACT_ENVIRONMENT`.
- Beyond the listed tests: `page.test.tsx` covers the server render of `grading_failed` and the `gradingRequestedAt` anchor; the status route also logs `grading.restart_failed` when the claim throws (response still 200).

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).

## Plan Change Log

- 2026-11-12, review patches (four lenses; coordinator, with user decisions of 2026-11-12):
  - Grading-run identity: `loadForGrading` returns `grading_requested_at`; the grader's final compare-and-set also matches it (`changeStatus` option `gradingRequestedAt`, `is null` for legacy rows). A run started before a Try again or a U4 restart (both move the stamp) is `lost`; `grading.lost` now means "the attempt moved on first" (Abandon or a superseded run).
  - Restart cap 3 (reverses the Design Notes assumption "No restart cap" and the frozen Never "Batas jumlah penilaian ulang", confirmed by the user 2026-11-13; frozen Never line amended): column `grading_restarts int not null default 0` added to the same migration 20261110000001 (not applied anywhere yet); `claim_grading_restart` increments it and refuses at 3; the trigger resets it to 0 on `grading_failed → received` (Try again, same UPDATE); not writable by session or service. At the cap, still `received` 15 s after the last restart, the status route moves the attempt `received → grading_failed` (service role, `changeStatus` with the stamp), logs `grading.restart_cap_reached` and answers `grading_failed`.
  - `file_missing` now writes `grading_failed` at once (a restart cannot restore the object; Try again can); the other store faults still leave `received`.
  - Status route: the claim/escalation runs only after the app-clock 15 s pre-check on a `received` attempt; `grading.service_env_missing` is logged once per process.
  - Try again: a throw from `scheduleGrading` after the compare-and-set still answers `retried` (U4 picks the attempt up) and logs `grading.schedule_failed`.
  - Exam screen: a Try again error is shown only while the attempt stays in the `grading_failed` that produced it (cleared when a poll leaves that status, and when a new Try again starts).
  - Dashboard Attempt Card: `grading_failed` caption "File received — grading failed." (as the exam screen's line 1).
  - Contract test derives the fence's edges from `transition()`; spine AD-9/AD-11 and EXPERIENCE.md (Dropzone hidden in `grading_failed`) amended.

## Review Triage Log

Four lenses (blind-hunter, intent-alignment 2026-11-11; edge-case-hunter, verification-gap 2026-11-12).

| # | Finding | Decision |
|---|---|---|
| 1 | Stale grading run (started before Try again / U4 restart) can overwrite the newer run | patched — final CAS also matches `grading_requested_at` |
| 2 | U4 restart unbounded; store faults (`file_missing` etc.) loop every 15 s forever, user never gets Try again | patched — `grading_restarts` cap 3 then `grading_failed`; `file_missing` → `grading_failed` at once (cap confirmed by the user 2026-11-13; frozen Never amended) |
| 3 | Claim RPC and service-env error log on every 2 s poll | patched — only after the 15 s pre-check; env log once per process |
| 4 | Try again: `after()` throws after CAS → error shown though status moved | patched — returns `retried`, logs `grading.schedule_failed` |
| 5 | Stale Try again error mislabels a later grading failure | patched — error state cleared when status leaves `grading_failed` |
| 6 | `unstable_rethrow`, `unchanged`, pending alert untested | patched — DOM tests |
| 7 | Fence edges hand-copied from `transition()` | patched — contract test derives edges from `transition()` |
| 8 | Dashboard card says "grading…" for `grading_failed` | patched |
| 9 | Spine AD-9/AD-11 no longer describe service-role use | patched — amended (user decision 2026-11-12) |
| 10 | Dropzone hidden in `grading_failed` vs EXPERIENCE.md | patched — EXPERIENCE.md corrected (user decision 2026-11-12) |
| 11 | `graded → closed` refused while 20261109 allowance remains | accepted — AD-5 has no such edge; new migration header notes the dead allowance |
| 12 | Code reads `grading_requested_at` → hard deploy order | accepted — migration applied dev → prod before deploy (AD-13) |
| 13 | Slow-message anchor resets on reload after a restart claim | deferred — cosmetic |
| 14 | Insert fence blocks data-only restores of non-open rows | accepted — restores disable triggers |
| 15 | Pre-hydration Try again form submit does nothing | rejected — button renders after hydration |

Checks after patches: lint, typecheck, test (60 files, 1134), build, test:db (98) pass.


## Design Notes

- [ASSUMPTION] New column instead of `received_at`: Try again keeps `received_at` (AD-8 duration, contract test `:428`), so `received_at` cannot tell how long the current grading has run. One column serves the stamp, the 15 s claim and the slow-message anchor on reload.
- ~~[ASSUMPTION] No restart cap~~ (superseded 2026-11-12, see Plan Change Log). Restart cap: at most 3 U4 restarts per grading request, counted by the database (`attempts.grading_restarts`, incremented by `claim_grading_restart`, reset by Try again); at the cap, a poll 15 s after the last restart moves the attempt `received → grading_failed`, so a persistent store fault ends at Try again instead of retrying until Abandon.
- [ASSUMPTION] AD-9 needs no edit: Try again's write and the restart claim are the grading path's service-role writes, each after the session read proved ownership.
- No Upload Dropzone in `grading_failed` (user decision 2026-11-12; EXPERIENCE.md amended): AD-6 accepts a file there only as a duplicate that is not stored, so it would mislead. Line 1 text "File received — grading failed." is UI chrome, not in the message set.
- [ASSUMPTION] Fence SQLSTATE 23514 (like `attempts_result_set_once`); `changeStatus` maps it to `failed` with the code in the log. In practice the CAS on `from` plus `transition()` never reaches it.
- jsdom `29.1.1` (2026-04-30), not 30.x: 30.x needs Node ≥ 22.22.2 / 24.15, the dev container runs 22.22.0; 29.1.1 accepts both it and CI's 24.x. `@testing-library/user-event` 14.6.9 is from today, so 14.6.8.
- Fence sketch (edges must equal `lifecycle.ts`):

```sql
if new.status is distinct from old.status and (old.status, new.status) not in (
  ('open','received'), ('open','abandoned'), ('open','closed'), ('received','graded'),
  ('received','grading_failed'), ('received','abandoned'), ('grading_failed','abandoned'), ('grading_failed','received')
) then raise exception 'attempts.status % -> % is not an AD-5 transition', old.status, new.status
  using errcode = 'check_violation', constraint = 'attempts_status_ad5';
end if;
```

## Verification

**Commands:**
- `npm run lint` -- expected: clean.
- `npx tsc --noEmit` -- expected: no errors.
- `npm test` -- expected: green, DOM files under jsdom, no skipped tests.
- `npm run build` -- expected: succeeds.
- `pg_ctlcluster 16 main start` then `DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:db` -- expected: green, `schema_version` = `20261110000001`.

**Production check (orchestrator/user, after merge; not hitl):**
- Before the code deploys: migration `20261110000001_attempts_status_fence` applied to `dev`, then `prod`; `/health` shows `20261110000001` in both.
- In `dev` SQL, inside `begin … rollback`: `update public.attempts set status = 'open' where id = '<a graded attempt>'` fails with `attempts_status_ad5`; `select claim_grading_restart('<that id>')` as service role returns false.
- Production: one L01-P1 attempt Finish → Results as in 3.1 (the fence and stamp let the real path through); runtime logs show no `attempt.*_failed` with code 23514. A live Try again run belongs to entry 11.

### Production evidence (2026-11-13, deployment `dpl_Gm6GEP5fSjBw8H9QirYr3pLFwGfp`, PR #17)

Migration `20261110000001_attempts_status_fence` applied to dev and prod before the merge (dev: illegal `abandoned → open` refused inside a rolled-back block).

| Time (UTC) | Event | Detail |
|---|---|---|
| 01:08:09 | `attempt.started` | attempt `fc496faf`, L01-P1, scenario `kardus-karya-kemas` |
| 01:08:48.276 | macro submission | `received: true`, `duplicate: false` |
| 01:08:49.092 | `grading.done` | channel macro, outcome graded, score 20 (about 0.8 s after receipt) |

Row after grading: status `graded`, `grading_requested_at` = `received_at` (stamped by the trigger), `grading_restarts` 0, score 20, 1 correct. No error lines in the window. Try again was not exercised live (entry 11).
