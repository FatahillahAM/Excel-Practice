---
title: 'Hint dari awal sampai akhir'
type: 'feature'
ticket: '5'
created: '2026-11-13'
status: 'draft'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/DESIGN.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Hint dan jatahnya sudah ada di snapshot v2 (3.4), tetapi belum ada cara membukanya: tidak ada tabel `hint_reveals`, tidak ada RPC yang memeriksa jatah, layar exam tidak punya Hint Select/Hint Button, dan penilaian selalu memakai `hintsUsed: 0` (`src/app/api/submissions/grading.ts:78`), jadi potongan −5 per hint tidak pernah dihitung (CAP-7, CAP-5, B5, U3).

**Approach:** Satu migrasi baru membuat `hint_reveals` (unik per percobaan, soal, indeks hint) dengan pagar insert untuk semua role, dan RPC `reveal_hint` (security definer, hanya `service_role`) yang dalam satu transaksi mengunci baris percobaan, mensyaratkan `open`, membaca jatah dan teks hint dari snapshot, dan hanya mencatat indeks berikutnya. Server Action memanggilnya lewat service role setelah sesi dan kepemilikan dicek (AD-9 diubah); layar exam menampilkan Hint Select + Hint Button dan daftar hint yang sudah dibuka, direhidrasi dari server saat muat ulang/Resume; penilaian membaca jumlah `hint_reveals` dan meneruskannya ke `grade()`.

## Boundaries & Constraints

**Always:**
- Hint hanya tercatat saat percobaan `open`, di dalam satu transaksi yang mengunci baris `attempts` (`for update`), sehingga Finish/upload/Abandon yang bersamaan berurutan dengannya; setelah status pindah, hint berikutnya ditolak.
- Jatah = `snapshot.hintQuota` (bukan konten saat ini); jumlah hint per percobaan (semua soal) tidak pernah melebihi jatah. Teks hint diambil dari `snapshot.questions[n].hints`; hint dibuka berurutan per soal (indeks berikutnya), tidak bisa melompat.
- Pagar database untuk setiap role (termasuk superuser): insert ke `hint_reveals` ditolak bila percobaan bukan `open` atau jatah sudah habis (SQLSTATE 23514). Tidak ada role yang punya izin insert/update/delete langsung; tulisan hanya lewat `reveal_hint`.
- Klik ganda tidak memakai dua jatah: request membawa indeks hint yang dimaksud; indeks yang sudah tercatat dikembalikan apa adanya tanpa potongan baru.
- Server Action: cek sesi; kepemilikan lewat bacaan sesi (RLS); RPC lewat service role (sesi tidak punya izin tulis, AD-9). Teks hint yang belum dibuka tidak pernah sampai ke browser; snapshot tetap tidak terbaca sesi.
- `hintsUsed` untuk penilaian = jumlah baris `hint_reveals` percobaan itu, dibaca service role saat menilai; `grade()` menolak (throw) `hintsUsed` > `snapshot.hintQuota`. Skor = poin soal benar − 5 × hint, minimal 0.
- Rehidrasi dari server: render halaman exam membaca jatah, daftar soal, dan hint yang sudah dibuka; tidak ada state hint di browser storage.
- UI sesuai EXPERIENCE/DESIGN: Hint Select "Hint for" (Soal 1…N), Hint Button "Hint (−5)" + "N left" dengan nama aksesibel "Hint for Soal N, minus 5 points, K left"; tidak bisa diaktifkan saat pending; fokus pindah ke teks hint baru (`tabindex="-1"`); jatah 0: tetap di tempat, `aria-disabled`, "No hints left", fokus tetap. Teks hint dan pesan `lang="id"`. Tanpa grup hint bila `hintQuota` 0.
- Pesan Indonesia di `src/messages/id.ts`; baris baru juga dicatat di EXPERIENCE.md › System message set.
- Migrasi diterapkan ke `dev` lalu `prod` oleh orchestrator sebelum kode di-deploy (AD-13), bukan oleh implementer.

**Never:**
- Isi/varian Results, baris potongan, Tips di Results (3.6); gerak Results (3.7); History (3.8); Tips & Tricks (3.9).
- Mengubah migrasi lama, bentuk snapshot v2, `Result`/`RESULT_VERSION`, atau konten L01-P1.
- Membuka hint untuk percobaan yang bukan `open`; memberi sesi akses baca ke `snapshot`; memanggil Supabase dari browser.
- Membatalkan/menghapus hint yang sudah dibuka; mengembalikan jatah.
- Tes yang di-skip atau ditunda.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Hint pertama | `open`, jatah 3, Soal 2 dipilih, klik | baris (attempt, 2, 0); "Hint 1 · Soal 2" tampil inline, fokus ke teksnya; tombol "2 left" | — |
| Tiga hint | tiga klik (soal mana pun) | 3 baris; tombol `aria-disabled` "No hints left", fokus tetap | — |
| Hint keempat | jatah habis (UI lama di tab lain / request paksa) | RPC `quota_used`, tidak ada baris baru; UI menampilkan "No hints left" | log info `hint.refused` |
| Klik ganda | dua submit dengan indeks yang sama | satu baris; respons kedua `already` dengan teks yang sama, tanpa potongan | — |
| Soal habis hint | semua hint soal itu sudah dibuka, jatah masih ada | `no_more_hints`; tombol `aria-disabled` untuk soal itu | — |
| Lompat indeks | indeks > berikutnya | `out_of_order`, tidak ada baris | UI memuat ulang state |
| Bukan `open` | `received`/`grading_failed`/`graded`/`abandoned`/`closed` | `not_open`, tidak ada baris; pesan "Hint cuma bisa dibuka selama percobaan masih berjalan, ya." | — |
| Balapan Finish | reveal dan `open → received` bersamaan | berurutan oleh kunci baris: hint tercatat sebelum `received`, atau ditolak `not_open` | — |
| Bukan pemilik / id rusak / tanpa sesi | | error tanpa info / Login lalu kembali ke `/exam/<id>` | — |
| DB/env service tak tersedia | | "Koneksi lagi bermasalah. Coba lagi sebentar, ya."; tombol aktif lagi, fokus ke tombol | log `hint.reveal_failed` |
| Muat ulang / Resume | `open` dengan 2 hint | jatah "1 left" dan 2 hint tampil dari server | baca state gagal: grup hint tidak tampil, upload tetap ada; log `exam.hint_state_failed` |
| Superuser insert | percobaan `received`, atau baris ke-4 saat jatah 3 | 23514 (`hint_reveals_open_only` / `hint_reveals_quota`) | — |
| Dinilai | L01-P1 semua benar, 3 hint | `Result.hintsUsed` 3, `hintPenalty` 15, skor 85 | — |
| Lantai 0 | 10 poin benar, 3 hint | skor 0 | — |
| Data korup | `hintsUsed` 4 > `hintQuota` 3 | `grade()` throw → `grading_failed` (`grade_threw`) | log yang ada |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261110000001_attempts_status_fence.sql` -- latest; copy its conventions: header comment, `set search_path = ''`, `security definer` + `revoke execute … from public, anon, authenticated` + `grant execute … to service_role`, `raise exception … using errcode = 'check_violation', constraint = '…'`, `schema_version` bump at the end.
- `supabase/migrations/20261102000001_attempts.sql:58-85` -- `revoke all … from anon, authenticated, service_role` then explicit grants; owner policies via `auth.uid()`. Default privileges grant every API role everything on new `public` tables: revoke first.
- `supabase/migrations/20261104000001_attempts_snapshot.sql` -- snapshot readable only by service role; set once.
- `supabase/tests/contract.db.test.ts` -- helpers `as`, `asUser`, `asService`, `newUser`, `start`, `attemptIn(status)`, `expectSqlError(code, constraint)`; add a snapshot-writing helper (service role, once, while `open`). Second `pg.Client` for the concurrency case (see `beforeAll` for the scratch DB URL).
- `src/adapters/supabase/migrations.test.ts` -- each migration sets its own `schema_version`.
- `src/core/content/level-module.ts` -- `ExamSnapshot` (`hintQuota`, `questions[].number`, `questions[].hints`), `examSnapshotSchema`; read-only here.
- `src/core/grading/grade.ts:17-18` -- add the `hintsUsed > snapshot.hintQuota` refusal next to the existing integer check; `scoreOf`/`HINT_PENALTY_POINTS` in `result.ts` unchanged.
- `src/core/grading/grade-attempt.ts` -- `GradingAttempt` gains `hintsUsed: number`; `gradeAttempt(attemptId, ports)` drops the `options` argument and passes `loaded.value.hintsUsed`; header table unchanged (a count failure is `load_failed`).
- `src/adapters/supabase/attempts.ts:424-462` -- `GradingRow` + `loadForGrading`: add a head count on `hint_reveals` (`select('*', { count: 'exact', head: true }).eq('attempt_id', id)`); error → `{ ok: false }` with `attempt.load_for_grading_failed`. `readAttempt`, `isAttemptId`, `logError`, `Read<T>` to reuse.
- `src/app/api/submissions/grading.ts:78` -- `{ hintsUsed: 0 }` removed; `gradingPorts` unchanged otherwise.
- `src/core/services/attempts/index.ts` -- barrel; add the pure hint helpers here (`hints.ts`).
- `src/app/(app)/exam/[attemptId]/retry-actions.ts` -- Server Action shape to copy (`run` + redirect outside try, `isAttemptId`, session → `readAttempt` → service client → write; log events).
- `src/app/(app)/exam/[attemptId]/page.tsx` -- `loadAttempt` (session read, redirect rules); add the hint-state read for `open` attempts and pass it to `ExamStatus`. `page.test.tsx` mocks `@/adapters/supabase/attempts` and the session: extend with the service client and hint adapter.
- `src/app/(app)/exam/[attemptId]/exam-status.tsx` -- renders Orbit, status line, Upload Dropzone while `open`; `applyStatus` on poll. The hint group goes beside the Dropzone (DESIGN › Layout: side by side ≥8px, stacked on phone), the revealed list below them, both only while `open`. `PRIMARY_BUTTON` pattern for classes; `useActionState` pattern from Try again.
- `src/app/(app)/exam/[attemptId]/exam-status.dom.test.tsx` + `src/test/dom.ts` -- harness (fake timers, `userEvent.setup({ advanceTimers })`, mocked `next/navigation` and server actions).
- `src/components/ui/dropdown-menu.tsx` -- shadcn new-york on the `radix-ui` 1.8.1 meta package: same pattern for a new `select.tsx`.
- `src/messages/id.ts:43` -- `examMessages`; add `hintMessages`.
- Mockup `mockups/key-exam.html:302-312,362-371` -- markup of the hint group, pending/off states and the revealed block ("Hint 1 · Soal 3", "−5").
- Spine AD-9 (`:119`, service-role list), AD-5 (`:79`, hint reveal rule), AD-3 (`:67`, `hintsUsed`).
- deferred-work.md -- open item "`grade()` does not compare `hintsUsed` with the snapshot's `hintQuota`" belongs here; "hints required while `hintQuota` 0" stays open (Ujian Akhir content), this ticket only hides the hint group at quota 0.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261113000001_hint_reveals.sql` -- (1) `public.hint_reveals (attempt_id uuid not null references public.attempts(id) on delete cascade, question_number int not null check (question_number >= 1), hint_index int not null check (hint_index >= 0), revealed_at timestamptz not null default now(), primary key (attempt_id, question_number, hint_index))`; `hint_index` is 0-based (the array position in `snapshot.questions[n].hints`; UI shows +1). (2) RLS on; `revoke all … from anon, authenticated, service_role`; `grant select` to `authenticated` with policy "hint reveals are readable by the attempt's owner" (`exists` on `attempts` with `user_id = auth.uid()`); `grant select` to `service_role`; no insert/update/delete grant to anyone. (3) `hint_reveals_fence()` before insert, every role: the attempt row (`for update`) must be `open` (else 23514 `hint_reveals_open_only`) and existing rows for the attempt < `coalesce((snapshot->>'hintQuota')::int, 0)` (else 23514 `hint_reveals_quota`). (4) `reveal_hint(p_attempt_id uuid, p_question int, p_hint_index int) returns jsonb`, `security definer`, `set search_path = ''`: lock the attempt (`select status, snapshot … for update`); in order: `not_found`; `not_open`; `snapshot_invalid` (no integer `hintQuota` or no `questions` array); `no_question`; `next` = count for (attempt, question): `p_hint_index < next` → `already` (with that hint's text, no insert), `> next` → `out_of_order`; index ≥ hints length → `no_more_hints`; used ≥ quota → `quota_used`; else insert → `revealed`. Always returns `{code, question, hintIndex, hint (text or null), used, quota}`. Execute revoked from public/anon/authenticated, granted to `service_role`. (5) Header comment: writes only through `reveal_hint`; deploy order (code reads the table). (6) Bump `schema_version` to `20261113000001`.
- [ ] `supabase/tests/contract.db.test.ts` -- `describe("hint_reveals + reveal_hint (B5, AD-5, AD-9)")`: v2-like snapshot helper (`hintQuota` 3, questions 1–4 with 3 hints; one question with 1 hint); three reveals → `revealed` with used 1,2,3 and the snapshot text; fourth → `quota_used`, still 3 rows; same index twice → `already`, one row; `out_of_order`; `no_more_hints`; `no_question`; `not_found`; `snapshot_invalid` (snapshot null); `not_open` for `received`, `grading_failed`, `graded`, `abandoned`, `closed`; `reveal_hint` not executable by `authenticated`/`anon` (42501); direct insert/update/delete as `authenticated` and `service_role` → 42501; superuser insert on a `received` attempt → 23514 `hint_reveals_open_only`, 4th superuser row → 23514 `hint_reveals_quota`; duplicate PK → 23505; owner selects own rows, other user sees 0, anon 42501; deleting the attempt cascades. Concurrency: two clients, used = 2, both call `reveal_hint` for different questions inside open transactions → exactly one `revealed`, the other `quota_used`; reveal blocked behind an uncommitted `open → received` returns `not_open`.
- [ ] `src/core/services/attempts/hints.ts` (+`hints.test.ts`, export from `index.ts`) -- pure: `HintReveal {question, index, text}`, `HintState {quota, used, questions: {number, hintCount}[], revealed: HintReveal[]}`; `hintState(snapshot: ExamSnapshot, rows: {question_number, hint_index}[]): HintState` (texts from the snapshot, ordered by reveal order as given; rows not in the snapshot dropped); `nextHintIndex(state, question)`; `hintsLeft(state)`.
- [ ] `src/adapters/supabase/hints.ts` (+`hints.test.ts`) -- service-role only (header says so, AD-9): `readHintState(service, attemptId): Promise<Read<HintState | null>>` (snapshot via `examSnapshotSchema` + rows ordered `revealed_at, hint_index`; invalid snapshot → `null`; log `hint.state_read_failed`); `revealHint(service, attemptId, question, hintIndex): Promise<Read<RevealAnswer>>` (rpc, zod-parse the jsonb, `isAttemptId` guard, log `hint.reveal_failed` with the db code).
- [ ] `src/core/grading/grade.ts` (+`grade.test.ts`) -- throw when `hintsUsed > snapshot.hintQuota`; tests: 3 hints on all-correct → 85 (`hintPenalty` 15); 3 hints on 10 points → 0; 4 hints with quota 3 → throws; 3 hints with quota 3 → fine.
- [ ] `src/core/grading/grade-attempt.ts` (+test), `src/adapters/supabase/attempts.ts` (+test), `src/app/api/submissions/grading.ts` (+`grading.test.ts`), `src/core/grading/__fixtures__/exam.ts`, `retry-flow.test.ts`, `parity.test.ts` -- `hintsUsed` from `load`; `loadForGrading` returns the count (count error → `ok: false`); grading test: L01-P1 `correct` fixture with `hintsUsed: 3` from the mocked load → written `Result` score 85, `hintsUsed` 3; `hintsUsed: 4` → `grading_failed` (`grade_threw`); all existing callers drop the options argument.
- [ ] `src/app/(app)/exam/[attemptId]/hint-actions.ts` (+`hint-actions.test.ts`) -- `"use server"` `revealHint(prev, formData{attemptId, question, hintIndex}): Promise<HintActionState>`: no session → redirect to Login with `/exam/<id>` (outside try); bad id / bad ints (`question` 1–99, `hintIndex` 0–9) / `readAttempt` null → `error`; status ≠ `open` → `not_open` (no RPC); service null → `error`; RPC answer mapped 1:1 (`revealed`, `already`, `quota_used`, `no_more_hints`, `out_of_order`, `not_open`; `not_found`/`no_question`/`snapshot_invalid` → `error`), each carrying `{reveal?, used, quota}`; logs `hint.revealed` (info: attemptId, question, hintIndex, used), `hint.refused` (info: code), `hint.reveal_failed`; throw → `error`.
- [ ] `src/components/ui/select.tsx` -- shadcn new-york `Select` on `radix-ui` (as `dropdown-menu.tsx`), height `exam-control-height`, `card` fill, `input-border`, `rounded.md`.
- [ ] `src/app/(app)/exam/[attemptId]/hint-panel.tsx` -- client: props `attemptId`, `initial: HintState`, `beside` (the Dropzone node). Hint Select labelled "Hint for" with options `Soal N` (`lang="id"`), default Soal 1; Hint Button form (`useActionState`) posting `attemptId`, `question`, `hintIndex = nextHintIndex`; warning styles per DESIGN; label "Hint (−5)" + "K left"; `aria-label` "Hint for Soal N, minus 5 points, K left"; pending: spinner, 70% opacity, `aria-disabled` and submit ignored (focus stays); `revealed`/`already` → add/keep the reveal, focus its block; `quota_used` → used = quota; quota 0 → "No hints left", `aria-disabled`, focus kept; selected soal exhausted → `aria-disabled`, label "All hints for Soal N shown"; `not_open` / `error` → `hintMessages` in a `role="alert"` `lang="id"` line, focus back to the button; `out_of_order` → `router.refresh()`. Revealed list in reveal order: block with 3px warning left border, "Hint k · Soal N" + "−5" (label, warning), text `lang="id"`, `tabindex="-1"`. Polite live region: "K hints left" after a reveal.
- [ ] `src/app/(app)/exam/[attemptId]/exam-status.tsx` + `page.tsx` (+`page.test.tsx`) -- `ExamStatus` prop `hints: HintState | null`; while `open` and `hints?.quota > 0`, render `HintPanel` with the Dropzone as `beside`, else the Dropzone alone (as now); nothing hint-related in other statuses. `page.tsx`: for an `open` attempt after the session read, `createServiceClient()` → `readHintState`; null env / failure / invalid snapshot → `hints: null` + log `exam.hint_state_failed`; page tests: open attempt passes the state; non-open does not call the service; failure renders without hints.
- [ ] `src/app/(app)/exam/[attemptId]/hint-panel.dom.test.tsx` -- mocked `./hint-actions`, router; (a) select Soal 2, click → action gets `question 2`, `hintIndex 0`; hint block "Hint 1 · Soal 2" shown and focused; button "2 left"; (b) three reveals → "No hints left", `aria-disabled`, focus remains on the button, further clicks do not call the action; (c) double click while pending → action called once; (d) `already` → no duplicate block; (e) rehydrated initial state (2 reveals) renders both blocks and "1 left"; (f) `error` → network alert, button usable, focused; (g) `not_open` → alert text; (h) quota 0 state from props → no hint group via `ExamStatus`. Add to `src/test/dom.ts` the jsdom stubs Radix Select needs (`hasPointerCapture`, `releasePointerCapture`, `scrollIntoView`) if missing.
- [ ] `src/messages/id.ts` -- `hintMessages.notOpen` "Hint cuma bisa dibuka selama percobaan masih berjalan, ya." and `hintMessages.failed` = Login "network" row verbatim.
- [ ] `_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md` -- AD-9: add to the service-role list "the exam screen's hint Server Action (`reveal_hint`) and the exam page's read of hint state (quota, question numbers, revealed hint texts from the snapshot), each only after the session read proved the attempt is the user's"; AD-5: reveals go through `reveal_hint` (security definer, service role only) that locks the attempt row; a database fence refuses inserts outside `open` or past the snapshot's quota for every role; AD-3: `grade()` refuses `hintsUsed` above the snapshot's `hintQuota`.
- [ ] `_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md` -- message set rows "Hint — attempt no longer open" and "Hint — network / server" (illustrative); Hint Button row: soal with no hints left → `aria-disabled` "All hints for Soal N shown"; hint group only while `open`.
- [ ] `_bmad-output/implementation-artifacts/deferred-work.md` -- the `hintsUsed` vs `hintQuota` entry: `status: done — grade() throws above the quota; reveal_hint and the hint_reveals fence enforce it (3.5)`.

**Acceptance Criteria:**
- Given an `open` L01-P1 attempt, when three hints are revealed, then a fourth `reveal_hint` call returns `quota_used` and `hint_reveals` holds 3 rows (contract test and DOM test).
- Given that attempt finished with an all-correct file, when it is graded, then `Result.hintsUsed` is 3, `hintPenalty` 15 and score 85 (grading test).
- Given a reload or Resume of an `open` attempt with reveals, then the exam page renders the same revealed hints and remaining quota from the server.
- Given `npm test` and `npm run test:db`, then all pass with no skipped tests.

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

- [ASSUMPTION] Hint text is not copied into `hint_reveals`: the RPC and the page read it from the snapshot (AD-3 source of truth). The session may `select` its own reveal rows (owner-only policy, AD-9 rule for exposed tables), but the page's state comes from the service-role read because quota, question numbers and texts live in the snapshot the session cannot read.
- [ASSUMPTION] Idempotency through the explicit `p_hint_index` (the client's next index for that soal): a double submit sends the same index twice and the second answer is `already`. The RPC still allows only the next index, so hints stay in order.
- [ASSUMPTION] `grade()` refuses rather than clamps: the fence makes the case unreachable for every role, so a count above the quota means corrupt data, and a silently clamped score would disagree with the stored reveals.
- [ASSUMPTION] Pending uses `aria-disabled` + an ignored submit instead of the `disabled` attribute, so focus is not dropped to `<body>` before it moves to the new hint (EXPERIENCE: "disabled while pending, then focus moves to the new hint text").
- [ASSUMPTION] All revealed hints are listed (reveal order), each labelled with its soal; with a quota of 3 the list stays short, and nothing paid for is hidden by the Select.
- [ASSUMPTION] Hint state read fails → the exam still works without the hint group (upload and Finish matter more); logged.
- Migration version `20261113000001` (after `20261110000001`). Hard deploy order: `loadForGrading` counts `hint_reveals`; without the table every load fails (`load_failed`, U4 restarts, then `grading_failed`).

```sql
-- reveal_hint core (sketch)
select status, snapshot into v_status, v_snap from public.attempts where id = p_attempt_id for update;
if not found then return jsonb_build_object('code','not_found'); end if;
if v_status <> 'open' then return jsonb_build_object('code','not_open'); end if;
select count(*) into v_next from public.hint_reveals where attempt_id = p_attempt_id and question_number = p_question;
-- already / out_of_order / no_more_hints / quota_used, then insert and return 'revealed'
```

## Verification

**Commands:**
- `npm run lint` -- expected: clean.
- `npx tsc --noEmit` -- expected: no errors.
- `npm test` -- expected: green, DOM files under jsdom, no skipped tests.
- `npm run build` -- expected: succeeds.
- `pg_ctlcluster 16 main start` then `DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:db` -- expected: green, `schema_version` = `20261113000001`.

**Production check (orchestrator/user, after merge; not hitl):**
- Before the code deploys: migration `20261113000001_hint_reveals` applied to `dev`, then `prod`; `/health` shows `20261113000001` in both. In `dev` SQL inside `begin … rollback`: superuser insert into `hint_reveals` for a `graded` attempt fails with `hint_reveals_open_only`.
- Laptop, Production: Start L01-P1; open 3 hints (e.g. Soal 1, then Soal 2 twice) — each shows inline with focus, quota 2 → 1 → 0, then "No hints left"; a 4th attempt (second tab with the old page) is refused with no new row; reload the exam page → the 3 hints and "No hints left" come back.
- Finish a fully correct file → Results shows 85/100; read-only SQL: `select count(*) from hint_reveals where attempt_id = '<id>'` = 3, `result->>'hintsUsed'` = 3, `result->>'hintPenalty'` = 15; runtime logs show three `hint.revealed`, one `hint.refused` and no `hint.reveal_failed`.
