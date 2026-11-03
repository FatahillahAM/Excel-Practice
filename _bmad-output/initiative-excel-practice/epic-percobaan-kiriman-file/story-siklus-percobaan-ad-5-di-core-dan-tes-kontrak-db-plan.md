---
title: 'Siklus percobaan AD-5 di core dan tes kontrak DB'
type: 'feature'
ticket: '2'
created: '2026-11-03'
status: 'in-review'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: '45bbec117508fc0b5be1661a3e992c442bcb6b30'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Transisi `attempts.status` hanya ada sebagai `markReceived` di adapter, tanpa mesin AD-5, dan belum ada jalur Abandon. Grant, RLS, dan index migrasi hanya diuji lewat client palsu (deferred dari entry 1).

**Approach:** Mesin status murni di `src/core/services/attempts` memberi status berikutnya atau penolakan bertipe. Adapter memanggilnya lalu menulis dengan compare-and-set. Migrasi baru mengizinkan pemilik mengubah ke `abandoned` saja. Suite Vitest ber-gate `DATABASE_URL` menjalankan semua migrasi asli di Postgres 16 dengan stub `auth`/`storage`, lokal dan di job CI.

## Boundaries & Constraints

**Always:**
- Core hanya mengimpor `src/core/**` dan `zod` (AD-1).
- Transisi = persis diagram AD-5, termasuk received/grading_failed → abandoned.
- Setiap tulis status: `transition()` dulu, lalu `update … where id = ? and status = <from>`.
- `received_at` tetap diisi trigger, bukan klien.
- Service client hanya di jalur macro (AD-9). Abandon memakai sesi + RLS.
- Tes kontrak memakai file migrasi apa adanya, urut nama.

**Never:**
- UI atau tombol Abandon, Attempt Card (entry 7). `submit()`, `ALREADY_GRADED`/`ATTEMPT_CLOSED` (entry 3). Penulis graded/grading_failed/closed (epic 3, Ujian Akhir).
- RPC `security definer` untuk Abandon.
- Mengubah migrasi yang sudah diterapkan.
- Tes kontrak terhadap project Supabase `dev`/`prod`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Transisi sah | 8 sisi diagram | `{ ok: true, to }` | — |
| Transisi tak sah | mis. (`graded`, abandon), (`open`, grade_ok) | `{ ok: false, code: 'TRANSITION_REFUSED' }` | adapter tidak menulis |
| Abandon | pemilik, `open`/`received`/`grading_failed` | `abandoned`; `received_at` tak berubah; Start berikutnya boleh | — |
| Abandon ditolak | `graded`/`abandoned`/`closed` | `refused`, tanpa query update | — |
| Abandon kalah CAS | status berubah sebelum tulis | `lost` | pemanggil membaca ulang |
| DB: pemilik ke status lain | sesi set `received`/`graded` | ditolak RLS (0 baris / 42501) | — |

</frozen-after-approval>

## Code Map

- `src/adapters/supabase/attempts.ts` -- `AttemptStatus`, `IN_PROGRESS_STATUSES`, `markReceived` (CAS `open`); tipe pindah ke core.
- `src/app/api/submissions/macro/route.ts`, `src/app/(app)/levels/start-actions.ts` -- pemakai `markReceived` dan insert default `open`; tak berubah.
- `supabase/migrations/*.sql` -- butuh `auth.uid()`, `auth.users`, `storage.{buckets,objects,foldername}`, peran `anon`/`authenticated`/`service_role`/`supabase_auth_admin`.
- `src/core/submission/rejection-codes.ts` -- pola enum `as const`; `src/lint-rules.test.ts` sudah menjaga AD-1.
- `.github/workflows/ci.yml` -- satu job `check`; `package.json` belum punya driver Postgres.
- Container: Postgres 16.15 (`/usr/lib/postgresql/16/bin`, `psql` di PATH, `postgres`/`pg_ctl` tidak); `pg_ctlcluster 16 main start` berjalan (dicek 2026-11-03).

## Tasks & Acceptance

**Execution:**
- [x] `src/core/services/attempts/lifecycle.ts` (+`index.ts`) -- `AttemptStatus` (+skema zod), `IN_PROGRESS_STATUSES`, `INITIAL_STATUS`, `AttemptEvent` (`submit_accepted`, `abandon`, `time_limit`, `grade_ok`, `grade_error`, `retry_grading`), `transition(from, event)`.
- [x] `src/core/services/attempts/lifecycle.test.ts` -- semua pasangan status × event: 8 sah, sisanya ditolak.
- [x] `src/adapters/supabase/attempts.ts` (+tes) -- tipe dari core (re-export); `changeStatus(client, attemptId, from, event)` → `transition` lalu CAS, hasil `changed | refused | lost | failed`; `markReceived` = `changeStatus(service, id, 'open', 'submit_accepted')`, kontrak tetap; `abandon(supabase, attemptId)` (sesi): `readAttempt` → `changeStatus(…, status, 'abandon')`.
- [x] `supabase/migrations/20261103000001_attempts_abandon.sql` -- `grant update (status) on public.attempts to authenticated`; policy update `using (owner and status in ('open','received','grading_failed')) with check (owner and status = 'abandoned')`; `schema_version`.
- [x] `supabase/tests/supabase-stub.sql` -- peran (`anon`, `authenticated`, `service_role bypassrls`, `supabase_auth_admin`), `auth.users`, `auth.uid()` dari `request.jwt.claims ->> 'sub'`, `storage.buckets`/`objects` + `storage.foldername`, usage schema, dan default privileges `public` ke tiga peran API (agar `revoke` teruji).
- [x] `supabase/tests/contract.db.test.ts` -- `describe.skipIf(!process.env.DATABASE_URL)`; DB scratch `contract_<rand>` (stub + semua migrasi, drop di akhir); `asUser(uid)` = transaksi `set local role authenticated` + claims. Kasus: Start kedua 23505 pada `attempts_one_in_progress_idx`; `received_at` dari trigger, tak bisa diisi klien; tak bisa baca baris orang lain; delete hanya `open`; abandon hanya dari tiga status, ke `abandoned` saja, milik sendiri; `anon` tanpa akses.
- [x] `package.json` -- devDeps `pg` + `@types/pg` (versi pas); script `test:db` = `vitest run supabase/tests`.
- [x] `.github/workflows/ci.yml` -- job `db-contract`: service `postgres:16` (health check `pg_isready`), `DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres`, `npm ci`, `npm run test:db`.
- [x] `supabase/README.md` -- bagian "Contract tests": cara lokal (lihat Verification); stub bukan Supabase penuh.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- tandai entri contract test (baris ~41) selesai.

**Acceptance Criteria:**
- Given `DATABASE_URL` tidak di-set, when `npm run test`, then suite kontrak di-skip dan sisa tes lolos.
- Given Postgres 16 kosong, when `npm run test:db`, then semua migrasi termasuk `20261103000001` diterapkan tanpa galat dan setiap kasus lolos.
- Given tes route macro yang ada, when dijalankan, then lolos tanpa diubah.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes); the orchestrator applies the migration to `dev` then `prod`.

## Plan Change Log

## Review Triage Log

Pass 1 (4 lenses): 0 high, 1 medium, 12 low; patched 5, deferred 2, rejected the rest. Verification-gap found no gaps.

| # | Lens | Finding | Verdict | Route |
|---|------|---------|---------|-------|
| 1 | blind, edge | DB suite runs inside `npm run test` when `DATABASE_URL` is set, and `test:db` passes silently when it is unset | medium | patch: exclude `supabase/tests` from the default run; `test:db` fails without `DATABASE_URL` |
| 2 | blind, vg, edge | `markReceived` failure log renamed to `attempt.submit_accepted_failed` | low | patch: keep `attempt.mark_received_failed` |
| 3 | blind | Contract test hard-codes the newest migration version | low | patch: drop the literal, keep the newest-file check |
| 4 | blind | No test that `grading_failed → received` keeps the first `received_at` | low | patch: add the case |
| 5 | edge | `afterAll` queries an unconnected admin client and hides the setup error | low | patch: guard |
| 6 | blind, intent | `abandon()` has no caller | low | reject: entry 7 (Attempt Card) |
| 7 | blind, intent | Service role can make AD-5-forbidden transitions in the DB | low | defer: core is the single writer (AD-5); revisit a DB trigger with grading (epic 3) |
| 8 | blind | Abandon while grading runs leaves the grader's CAS `lost` | low | defer: epic 3 grader handles `lost` |
| 9 | intent | Storage policies not exercised by the contract suite | low | reject: stub storage is not Supabase's; covered by the Production check of 2.1 |
| 10 | edge | `changeStatus` with a non-UUID id logs `failed` | low | reject: callers pass ids already read from the DB |
| 11 | edge | Fake client returns undefined past its answers | low | reject: test-only, fails loudly as `failed` |
| 12 | edge | Parallel contract runs race on role creation | low | reject: CI runs one job per cluster |
| 13 | blind | RLS-hidden row counted as `lost` | low | reject: service role bypasses RLS; owner path returns `not_found` first |

## Design Notes

- Abandon lewat grant kolom + policy update, bukan RPC: `using` memeriksa baris lama (pemilik, tiga status), `with check` baris baru (`abandoned` saja). RPC `security invoker` butuh grant dan policy yang sama (hanya menambah permukaan); `security definer` melewati RLS. DB pagar kedua; core penentu transisi.
- Driver `pg`: set role/claims per transaksi; `psql` via child process lebih rapuh.
- Graded/grading_failed/closed hanya dikontrakkan di core (dan diuji di unit); penulis adapter-nya datang bersama epic 3.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test` -- expected: bersih; suite kontrak di-skip.
- `pg_ctlcluster 16 main start`, `su postgres -c "psql -c \"alter user postgres password 'postgres'\""`, lalu `DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:db` -- expected: semua kasus lolos.

**Manual checks:**
- Workflow CI: job `db-contract` hijau pada push.
- Migrasi `20261103000001` diterapkan orchestrator ke `dev` lalu `prod` (rename versi, `supabase/README.md`).
