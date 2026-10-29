---
title: 'CI: lint dengan aturan impor core, typecheck, dan Vitest'
type: 'chore'
ticket: '6'
created: '2026-10-29'
status: 'built'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: '457d6b8e8569dfa2bf0cab114abaf98cccb034d6'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Repo belum punya CI: lint, typecheck, dan Vitest hanya jalan kalau dijalankan manual, dan aturan AD-1 (`src/core/**` hanya mengimpor `src/core/**` dan `zod`) belum ditegakkan apa pun. Registry template yang "dihitung ulang di CI" (AD-4) juga belum benar-benar di CI.

**Approach:** Tambah aturan ESLint `no-restricted-imports` untuk `src/core/**` (allowlist `zod`, `@/core/**`, dan path relatif; ditambah `import/no-restricted-paths` agar path relatif tidak keluar dari `src/core`), script `typecheck`, satu tes contoh di `src/core`, tes yang menjalankan ESLint pada potongan kode agar aturan itu sendiri teruji, dan workflow GitHub Actions yang menjalankan lint, typecheck, dan Vitest di setiap push dan pull request ke `main`.

**Decisions (user, 2026-10-29):**
- User meminta build langsung sampai selesai tanpa berhenti di checkpoint ("langsung lanjut ke 1.6 sampai selesai build dan siap pakai").

## Boundaries & Constraints

**Always:** CI memakai Node 24.x (`engines`), `npm ci`, dan script yang sama dengan lokal (`npm run lint`, `npm run typecheck`, `npm run test`); aturan berlaku untuk `src/core/**` saja; pesan lint menyebut AD-1.

**Never:** secret atau akses jaringan ke Supabase/Vercel di CI; deploy dari CI (Vercel tetap deploy sendiri); mengubah kode di luar `src/core` agar lolos aturan; mematikan aturan lint yang ada.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Impor framework di core | `import "next/server"`, `react`, `@supabase/ssr`, `node:fs` di `src/core/x.ts` | ESLint error AD-1 | CI merah |
| Impor keluar core | `@/adapters/...`, `../../adapters/...`, `@/app/...` di `src/core/**` | ESLint error | CI merah |
| Impor sah | `zod`, `@/core/...`, `./x`, `../core-sibling` di dalam `src/core` | tanpa error | — |
| Di luar core | `import "next/server"` di `src/app/x.ts` | tanpa error | — |
| Push bersih | branch kerja | lint, typecheck, Vitest hijau | — |

</frozen-after-approval>

## Code Map

- `eslint.config.mjs` -- flat config `eslint-config-next` 16 (core-web-vitals + typescript), ESLint 9.39.5; `eslint-plugin-import` (`import/*`) dan `eslint-import-resolver-typescript` sudah terpasang lewat `eslint-config-next`.
- `package.json` -- script `lint` (`eslint .`), `test` (`vitest run`); belum ada `typecheck`; `engines.node` `24.x`; lockfile ada (`npm ci`).
- `tsconfig.json` -- alias `@/*` → `./src/*`; `npx tsc --noEmit` bersih saat ini.
- `src/core/submission/rejection-codes.ts` -- satu-satunya file core; tanpa impor.
- `.github/` -- belum ada.
- Vitest tanpa config (default include `**/*.test.ts`); 133 tes, semuanya offline (tanpa Supabase/jaringan). `scripts/spike-*.ts` tidak dijalankan CI.

## Tasks & Acceptance

**Execution:**
- [x] `eslint.config.mjs` -- blok `files: ["src/core/**/*.{ts,tsx}"]` dengan `no-restricted-imports` (allowlist lewat `patterns`/`regex`) dan `import/no-restricted-paths` (target `src/core`, from `src`, except `./core`); pesan menyebut AD-1.
- [x] `src/core/lint-rules.test.ts` (atau di luar core bila aturan melarangnya) -- `ESLint.lintText` dengan `filePath` di `src/core` dan di `src/app` untuk setiap baris matriks.
- [x] `src/core/submission/rejection-codes.test.ts` -- tes contoh core (lima kode AD-6, nilai = nama).
- [x] `package.json` -- script `typecheck` = `tsc --noEmit`.
- [x] `.github/workflows/ci.yml` -- `on: push` (semua branch) dan `pull_request` ke `main`; Node 24 dengan cache npm; `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`; `permissions: contents: read`.

**Acceptance Criteria:**
- Given push ke branch kerja, when CI jalan, then ketiga langkah hijau.
- Given commit yang mengimpor `next` di `src/core`, when di-push, then CI merah di langkah lint (dibuktikan sekali dengan commit uji di branch kerja lalu di-revert).

## Implementation Notes

- `eslint.config.mjs`: blok `ad-1/core-imports` (`src/core/**/*.{ts,tsx}`) memakai `no-restricted-imports` dengan satu `patterns[].regex` yang menolak semua sumber kecuali `zod`, `@/core` (beserta subpath) dan path relatif; `import/no-restricted-paths` (target `./src/core`, from `./src`, except `./core`) menutup path relatif / `@/core/../x` yang keluar dari core. Semua pesan diawali "AD-1:".
- Tambahan di luar daftar tugas: `no-restricted-syntax` melarang `import()` dinamis dan `require()` di core, karena `no-restricted-imports` tidak memeriksa keduanya (celah AD-1).
- Tes di `src/core/**/*.test.{ts,tsx}` boleh mengimpor `vitest` (blok `ad-1/core-tests`, allowlist sama + `vitest`); file non-tes di core tetap ditolak bila mengimpor `vitest`.
- Tes aturan ditempatkan di `src/lint-rules.test.ts` (di luar core) karena mengimpor `eslint` dan `node:path`, yang dilarang aturan core.
- `npm run typecheck` sudah dicoba pada checkout bersih (git worktree tanpa `.next/` dan `next-env.d.ts`, keduanya gitignored) -- bersih, jadi CI tidak perlu `next build`/`next typegen` dulu.
- Workflow tanpa `concurrency.cancel-in-progress` supaya run merah untuk commit uji tidak dibatalkan oleh push revert berikutnya.
- Review patches (commit 73ab4ba): zone `from: "."` with `except` for `./src/core`, `./node_modules/zod` (and `./node_modules/vitest` in core tests); globs cover `ts, tsx, mts, cts, js, jsx, mjs, cjs`; core tests match `*.{test,spec}.*`; `no-restricted-syntax` also rejects `TSImportType` and member `require` calls; `no-restricted-globals` rejects IO globals (`fetch`, `process`, `XMLHttpRequest`, `WebSocket`, `window`, `document`, `localStorage`, `sessionStorage`, `indexedDB`, `navigator`); allowlist entries are regex-escaped. Suite: 182 tests.
- GitHub Actions (workflow `CI`, id 400261026) on `claude/laughing-shannon-vnoryl`: runs #1 (0cf6bf8), #2 (786f51d) and #3 (73ab4ba) green, about 30 s each. Probe commit e77a567 added `src/core/ci-probe.ts` importing `next/server`: run #4 failed at **Lint** with two AD-1 errors (`no-restricted-imports`, `import/no-restricted-paths`); Typecheck and Test were skipped. Revert e5c3bea removed it; run #5 (e5c3bea) green again on all three steps.
- Runner warning: `actions/checkout@v4` and `actions/setup-node@v4` target Node 20 and are forced onto Node 24; harmless today, move to the next major when convenient.

## Plan Change Log

## Review Triage Log

| # | Lens | Finding | Verdict | Evidence | Route |
|---|------|---------|---------|----------|-------|
| 1 | blind-hunter, edge-case-hunter | Relative imports that leave `src/` (`../../scripts/spike-s1`, `../../package.json`, `../../node_modules/next/server`) pass AD-1 | medium | Zone is `from: "./src"`; reviewers probed `lintText` and got no AD-1 error | patch: zone `from: "."`, `except: ["./src/core"]` |
| 2 | edge-case-hunter, blind-hunter, verification-gap | AD-1 blocks match only `.ts`/`.tsx`; `.js`, `.mjs`, `.mts` (allowJs) skip the rule; no `.tsx` test | medium | Probed: `next/server` in `src/core/x.mts` and `x.js` lints clean | patch: widen globs, add test cases |
| 3 | edge-case-hunter | Core test override matches only `*.test.*`; `*.spec.*` (Vitest default) cannot import `vitest` | low | Fails closed (lint error), but blocks a valid file name | patch: `{test,spec}` |
| 4 | blind-hunter, edge-case-hunter | `typeof import("next/server")` (TSImportType) not caught | low | `ImportExpression` selector does not match the TS node | patch: `TSImportType` selector |
| 5 | blind-hunter, edge-case-hunter | `module.require("fs")` / `globalThis.require("fs")` not caught | low | Selector matches only a bare `require` identifier | patch: member `require` selector |
| 6 | blind-hunter, edge-case-hunter | IO through globals (`fetch`, `process`, …) in core lints clean, though AD-1 says no network/IO | low | No `no-restricted-globals`; probed `fetch()` clean | patch: restrict IO globals in core |
| 7 | edge-case-hunter | Allowlist entries joined into the regex unescaped | low | Today's entries are safe, a later one with `.` would widen it; one-line fix | patch |
| 8 | blind-hunter | No test that core test files still reject framework imports, or that `vitest/*` is allowed | low | Override could loosen silently | patch: add cases |
| 9 | blind-hunter | Relative imports that do not resolve pass lint | false | `npm run typecheck` (CI step) fails on an unresolved module | reject |
| 10 | blind-hunter | `zod` allowlisted but not a dependency | false | Allowlist mirrors AD-1; zod (spine Stack 4.6.x) is added when core first needs it | reject |
| 11 | blind-hunter | CI has no `next build` step | low | Vercel builds every push and reports the status on the commit; a second build in Actions duplicates it | reject |
| 12 | blind-hunter | Push + pull_request run twice for a branch with an open PR | low | A few extra minutes; the push trigger on every branch is the intent (matrix row "Push bersih, branch kerja") | reject |
| 13 | blind-hunter | `node-version: 24.x` duplicates `engines.node` | low | Two places to change on a major bump; fix adds reliance on setup-node parsing `engines` | reject |
| 14 | blind-hunter | `tsc --noEmit` writes `tsconfig.tsbuildinfo` locally | low | Gitignored, CI starts clean | reject |
| 15 | blind-hunter | `expectRejected` does not check which rule fired | low | Each case is rejected only by an AD-1 message; pinning rule IDs adds brittleness | reject |
| 16 | edge-case-hunter, intent-alignment | Red CI on an AD-1 violation not shown on real Actions yet | false | Planned verification step after review (probe commit then revert), not a code defect | reject (done in verification) |
| 17 | intent-alignment | AD-4 recompute reaches CI only through the general test run | false | `templates.test.ts` recomputes the registry and runs under `npm run test` in CI; `.xlsm` is binary in git, not LFS | reject |

## Design Notes

`no-restricted-imports` saja tidak tahu lokasi file, jadi `../../adapters` dari `src/core/a/b.ts` lolos allowlist "path relatif"; `import/no-restricted-paths` menutup celah itu dengan resolver. Tes `lintText` membuat aturan ini teruji tanpa push merah setiap kali.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: bersih.

**Manual checks:**
- GitHub Actions di branch kerja: run hijau untuk commit bersih; run merah (lint) untuk commit uji impor `next` di `src/core`, lalu hijau lagi setelah revert.
