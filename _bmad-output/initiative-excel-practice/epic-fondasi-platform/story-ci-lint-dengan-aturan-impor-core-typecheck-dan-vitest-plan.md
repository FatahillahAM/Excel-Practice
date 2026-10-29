---
title: 'CI: lint dengan aturan impor core, typecheck, dan Vitest'
type: 'chore'
ticket: '6'
created: '2026-10-29'
status: 'in-progress'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
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
- [ ] `eslint.config.mjs` -- blok `files: ["src/core/**/*.{ts,tsx}"]` dengan `no-restricted-imports` (allowlist lewat `patterns`/`regex`) dan `import/no-restricted-paths` (target `src/core`, from `src`, except `./core`); pesan menyebut AD-1.
- [ ] `src/core/lint-rules.test.ts` (atau di luar core bila aturan melarangnya) -- `ESLint.lintText` dengan `filePath` di `src/core` dan di `src/app` untuk setiap baris matriks.
- [ ] `src/core/submission/rejection-codes.test.ts` -- tes contoh core (lima kode AD-6, nilai = nama).
- [ ] `package.json` -- script `typecheck` = `tsc --noEmit`.
- [ ] `.github/workflows/ci.yml` -- `on: push` (semua branch) dan `pull_request` ke `main`; Node 24 dengan cache npm; `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`; `permissions: contents: read`.

**Acceptance Criteria:**
- Given push ke branch kerja, when CI jalan, then ketiga langkah hijau.
- Given commit yang mengimpor `next` di `src/core`, when di-push, then CI merah di langkah lint (dibuktikan sekali dengan commit uji di branch kerja lalu di-revert).

## Implementation Notes

## Plan Change Log

## Review Triage Log

## Design Notes

`no-restricted-imports` saja tidak tahu lokasi file, jadi `../../adapters` dari `src/core/a/b.ts` lolos allowlist "path relatif"; `import/no-restricted-paths` menutup celah itu dengan resolver. Tes `lintText` membuat aturan ini teruji tanpa push merah setiap kali.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: bersih.

**Manual checks:**
- GitHub Actions di branch kerja: run hijau untuk commit bersih; run merah (lint) untuk commit uji impor `next` di `src/core`, lalu hijau lagi setelah revert.
