---
title: 'Refactor sweep'
type: 'refactor'
ticket: '10'
created: '2026-10-30'
status: 'built'
route: 'oneshot'
route_source: 'auto'
review: 'quick'
review_source: 'auto'
lenses_ran: ['quick']
review_loop_iteration: 0
baseline_revision: '263e9b2662af9eb4d8dd9feb64e30e012444799f'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Epic fondasi menyisakan 16 entri di `deferred-work.md`, satu error di log Production (`Date.now()` saat prerender pada `/settings` dan `/dev/bridge-proof`), dan dua perapian kecil dari catatan build: actions CI yang masih target Node 20, dan regex token yang terduplikasi.

**Approach:** Pekerjaan ini hanya pembersihan, terdiri dari tiga perbaikan kode, satu pengecualian di spine, dan disposisi untuk setiap entri tertunda.
- **`connection()` sebelum baca sesi:** `createClient()` di `src/adapters/supabase/server.ts` memanggil `await connection()` sebelum `cookies()`. Dengan begitu, baca sesi selalu terjadi saat request, tidak saat runtime prefetch.
- **Bump actions CI:** `actions/checkout` dan `actions/setup-node` di `.github/workflows/ci.yml` dinaikkan ke `v5`.
- **Satu regex token:** satu definisi `ATTEMPT_TOKEN_RE` di `src/adapters/workbook/generate.ts`, dipakai juga oleh `src/app/api/submissions/macro/inspect.ts`.
- **Pengecualian AD-9 di spine:** `app_meta` (metadata non-user) boleh dibaca publik untuk `/health`. Dicatat di spine dan `.memlog.md`.
- **Disposisi entri tertunda:** setiap entri di `deferred-work.md` mendapat disposisi di Implementation Notes: ditutup (dengan bukti) atau dipindah ke epic yang membangunnya (dengan alasan).

**Decisions (user, 2026-10-30):**
- `app_meta` publik dicatat sebagai pengecualian AD-9 di spine, bukan diubah.
- User mengecek sendiri penolakan akun Google non-allowlist ("Akun ini nggak terdaftar") sebagai bagian 1.10.

</frozen-after-approval>

## Implementation Notes

Oneshot: three small code edits (about 15 lines) plus a spine line and the disposition list; no new behavior.

- `src/adapters/supabase/server.ts`: `createClient()` awaits `connection()` before `cookies()`. Production logged the `Date.now()` prerender error from supabase-js `_loadSession` on `/settings` and `/dev/bridge-proof`; with `partialPrefetching` a runtime prefetch prerenders with cookies but rejects `Date.now()`, and `connection()` keeps the session read at request time. Not reproducible locally (needs a signed-in session); checked after merge in Production logs.
- `.github/workflows/ci.yml`: `actions/checkout@v5`, `actions/setup-node@v5` (Node 24 runtime; 1.6 note).
- `ATTEMPT_TOKEN_RE` exported once from `src/adapters/workbook/generate.ts`; `inspect.ts` imports it (its private copy removed).
- Spine AD-9 Rule names the `app_meta` exception; `.memlog.md` entry added.
- Checks: lint, typecheck, 405 tests and build clean.
- Production check after merge (deploy `dpl_ACGQFZu5AghfrbanrMbfHjsgrTy7`, `0a4b7a5`): the `Date.now()` prerender error is gone on `/settings` and `/dev/bridge-proof`, but `/settings` now logged `settings.account_failed` (name `Error`). `connection()` now interrupts the runtime prefetch prerender, and `AccountSections`' `try/catch` swallowed that Next interrupt, so the prefetched shell showed the first-load-failed message. Fix: `unstable_rethrow(error)` first in that catch; `npm run build` no longer logs `settings.account_failed` (it did twice before, the same swallowed interrupt at build time).
- Moved entries are recorded as `Parked` Notes in `epic-percobaan-kiriman-file.md` (rows 4, 6, 7, 8, 10, 13, 14) and `epic-progres-streak-dashboard.md` (row 12).

Deferred-work dispositions: `deferred-work.md` holds 15 entries (the Intent's "16" was a miscount):

| # | Entry (source) | Disposition | Evidence or reason |
|---|----------------|-------------|--------------------|
| 1 | Seed versions in epic Notes (1.1) | closed | Epic Notes Decision "versi seed dari entry 1" lists them |
| 2 | `vbaProject.bin` byte-identical after save (S1) | closed | Superseded: 1.11 fingerprints normalized VBA source per module; bytes never compared (AD-4) |
| 3 | Fingerprint by source, not `vbaProject.bin` bytes (S2) | closed | Done in 1.11; S3 and 1.9 matched in Production |
| 4 | Unpinned modules ignored vs exam-bridge "macro changed" (1.11) | moved → epic 2 (percobaan & kiriman file) | A spine decision that belongs with `submit()` and the attempt's template version |
| 5 | No CI recomputes the registry (1.11) | closed | 1.6 CI runs `npm run test`, which includes `templates.test.ts` |
| 6 | Unbounded inflate on the public macro route (S3) | moved → epic 2 | Bound with the upload size limit when `submit()` lands (spine Deferred) |
| 7 | modFinish messages per AD-6 code, 413/TLS/TEMP hints (S3) | moved → epic 2 | Any VBA edit needs a template rebuild and laptop run; rides the epic 2 VBA change |
| 8 | Template v1 release point (S3) | moved → epic 2 | Must be set before the first real attempt |
| 9 | `app_meta` public read vs AD-9 (1.5) | closed | Spine AD-9 exception (user, 2026-10-30) |
| 10 | No profile when the browser zone is invalid (1.7) | moved → epic 2 | `attempts` is owned by `profiles` (spine ER), so Start needs the row before streaks do |
| 11 | Non-allowlisted account message unverified (1.7) | closed | User, 2026-10-30: another Google account in an incognito window got "Akun ini nggak terdaftar" on Production, no session |
| 12 | No component-render harness (1.8) | moved → epic 4 | Add with the first content surface (Dashboard) |
| 13 | DB contract test for grants/RLS/RPC (1.9) | moved → epic 2 | Build with `attempts` |
| 14 | Drop `bridge_proofs`, its RPC and `/dev/bridge-proof` (1.9) | moved → epic 2 | Once `attempts` and `submit()` exist |
| 15 | `Date.now()` prerender error in Production (1.9) | closed | `connection()` in `createClient()` plus `unstable_rethrow` in Settings (PR #9); after the user opened `/settings` on deploy `dpl_GJfeknPSBP8XaVJ1Q1U1QfF3RutR` (`46b59a2`), Production logged neither the `Date.now()` error nor `settings.account_failed` |

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: bersih.

**Manual checks:**
- CI hijau di push branch kerja, tanpa peringatan Node 20.
- Setelah merge, membuka `/settings` dan `/dev/bridge-proof` di Production tidak lagi mencatat error `Date.now()`.
- User: login dengan akun Google lain → "Akun ini nggak terdaftar", tanpa sesi.

## Review Triage Log

Quick lens: 0 high, 1 medium, 2 low.

- medium, patch — "moved" entries were labelled only in this plan, so epic 2/4 would not see them: added `Parked` Notes to both epic envelopes (ticketing writes, user asked for the sweep).
- low, patch — entry 10 belongs before epic 4: the spine ER has `profiles` owning `attempts` (epic 2); moved to epic 2.
- low, patch — new AD-9 text called `app_meta` "the one exception", but `private.auth_allowlist` is not owner-only either: wording scoped to Data-API (`public`) tables and names the private allowlist; `.memlog.md` correction entry.
