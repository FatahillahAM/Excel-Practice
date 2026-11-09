# Deferred Work

- source_plan: `/home/user/Excel-Practice/_bmad-output/initiative-excel-practice/epic-fondasi-platform/story-tracer-scaffold-with-supabase-ter-deploy-ke-vercel-productio-plan.md`
  summary: Catat versi seed (next 16.4.2, react 19.3.1, typescript 5.9.3, @supabase/ssr 0.12.7, @supabase/supabase-js 2.118.0, tailwindcss 4.3.3, eslint-config-next 16.4.2, Node 24.x) di Notes epic fondasi lewat bmad-preview-ticketing.
  evidence: Field `unknown` entry 1 meminta versi seed dicatat di Notes epic, tetapi bmad-build tidak boleh menulis file tiket; versinya saat ini hanya ada di Implementation Notes plan.
- source_plan: `/home/user/Excel-Practice/_bmad-output/initiative-excel-practice/epic-fondasi-platform/spike-s1-apakah-template-xlsm-yang-di-patch-tetap-utuh-di-excel-20-plan.md`
  summary: Buktikan bahwa `xl/vbaProject.bin` tetap byte-identik setelah Excel 2021 membuka, menjalankan Finish, dan menyimpan file hasil patch, sebelum cek `IDENTITY_ALTERED` (AD-6) dibangun di S3 atau epic 2.
  evidence: Unverified, high bila benar. S1 hanya menguji membuka tanpa menyimpan. Bila Excel menulis ulang `vbaProject.bin` saat save (misalnya cache kode terkompilasi), setiap kiriman asli akan ditolak. Terjawab dengan membandingkan SHA-256 `vbaProject.bin` file yang disimpan Excel dengan registry (`d8aa9aa6…a9df`).
- source_plan: `/home/user/Excel-Practice/_bmad-output/initiative-excel-practice/epic-fondasi-platform/spike-s2-apakah-rumus-dan-nilai-terbaca-benar-dari-file-simpanan-e-plan.md`
  summary: Ubah sidik jari template di AD-4/AD-6 dari SHA-256 byte `xl/vbaProject.bin` menjadi hash sumber VBA hasil dekompresi per modul, lewat `bmad-architecture`, sebelum S3 dan cek `IDENTITY_ALTERED` dibangun.
  evidence: Terverifikasi, high. Fixture S2 yang disimpan Excel 2021 punya hash `vbaProject.bin` `9618df59…8ec4`, berbeda dari registry `d8aa9aa6…a9df`. Excel membuat ulang `ID=`, `CMG`, `DPB`, `GC` di stream `PROJECT` dan cache kompilasi setiap kali menyimpan, sedangkan sumber VBA semua modul identik. Dengan aturan sekarang, setiap kiriman asli akan ditolak.
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/story-sidik-jari-sumber-vba-ad-4-menggantikan-hash-vbaproject-bin-plan.md`
  summary: AD-4 ignores modules the template does not pin, so code added to ThisWorkbook, a sheet module, or a new module keeps the identity, while exam-bridge.md says changed macro code means identity altered.
  evidence: matchesTemplate compares pinned modules only (tested "extra standard module" case); options are requiring unpinned modules to normalize empty or recording that added code is accepted (spine decision).
  status: done — `matchesTemplate` now requires every module the template does not pin to normalize to empty (`EMPTY_MODULE_SHA256`), as AD-4 says; added code in ThisWorkbook, a sheet or a new module is `IDENTITY_ALTERED`, a new sheet's empty module and S3 still match (story 2.3, 2026-11-03).
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/story-sidik-jari-sumber-vba-ad-4-menggantikan-hash-vbaproject-bin-plan.md`
  summary: AD-4 says registry values are recomputed in CI, but the repo has no CI workflow that runs npm test.
  evidence: no .github/workflows; Vercel only runs next build, so the registry recompute test runs only locally.
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/spike-s3-apakah-tombol-finish-bisa-mengirim-file-ke-https-dari-lap-plan.md`
  summary: POST /api/submissions/macro is public and runs readWorkbook on any body with no bound on inflated size, so a small zip bomb can exhaust the function.
  evidence: read.ts has no uncompressed-size or entry cap (pre-existing since S2); the spine defers the upload size limit to epic 2; bound inflated size and body size before or inside readWorkbook when submit() lands.
  status: done — the macro route refuses bodies over 4 MiB (`MAX_SUBMISSION_BYTES`) with 413 `FILE_TOO_LARGE` before reading (Content-Length) or while streaming; `readWorkbook` caps a package at 1 000 entries and 32 MiB inflated in total, inflating each part as a stream without trusting declared sizes (→ `NOT_EXCEL`) (story 2.3, 2026-11-03). The upload route's limit and its web message stay with entry 5. Upload closed too: `POST /api/submissions/upload` reads through the same `readBoundedBody` (`src/app/api/submissions/http.ts`) and `FILE_TOO_LARGE` message (story 2.5; confirmed in sweep 2.11, 2026-11-09).
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/spike-s3-apakah-tombol-finish-bisa-mengirim-file-ke-https-dari-lap-plan.md`
  summary: Epic 2 modFinish follow-ups — map each AD-6 code to an Indonesian message box (rejection-codes.ts contract), give non-network hints for 413, TLS/certificate and local TEMP failures, and fix the TempCopyPath comment (always .xlsm).
  evidence: S3's modFinish shows the raw code and always blames the connection; any VBA edit needs a template rebuild and laptop run, so these ride the epic 2 VBA change.
  status: done — story 2.9: `modFinish.bas` maps every answer to a `macroMessages` box, with non-network hints for 413, TLS and TEMP and the `TempCopyPath` comment "Always .xlsm"; laptop check steps 6–13 passed in Preview (2026-11-06) (sweep 2.11, 2026-11-09).
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/spike-s3-apakah-tombol-finish-bisa-mengirim-file-ke-https-dari-lap-plan.md`
  summary: Mark when template v1 counts as released (before the first real attempt) so a later modFinish change ships as v2 instead of an in-place registry edit.
  evidence: S3 changed v1 in place twice because v1 was unreleased; nothing records or enforces the release point.
  status: done — story 2.12: after the end-to-end Production run passed, `templates.ts` marks v1 `released` (2026-11-09, file SHA-256 `aa2b82e2…`) and `templates.test.ts` fails with "released — ship exam.v2.xlsm" if the committed file changes; README procedure now produces v2 (2026-11-09). Previously: moved — story 2.12 (sweep 2.11, 2026-11-09).
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/story-environment-dev-supabase-dev-preview-ke-dev-dan-migrasi-sql-plan.md`
  summary: AD-9 says every table has owner-only RLS and the browser never calls tables, but app_meta has a public select policy so the unauthenticated /health can read schema_version with the publishable key.
  evidence: /health has no session and the service-role client is limited to the macro path; either add a spine exception for non-user metadata (bmad-architecture) or read it differently once Google sign-in exists (entry 7).
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/story-sign-in-with-google-dengan-allowlist-satu-akun-plan.md`
  summary: A sign-in without a valid browser time zone succeeds but leaves no profiles row until a later sign-in, which AD-8 consumers (streaks, freezes) will assume exists.
  evidence: ensureProfile returns 'skipped' and the session lasts ~30 days; create or require the profile before the first AD-8 consumer lands (epic 3).
  status: done — story 2.1: `requireProfile` in `start-actions.ts` creates the profile from the form's zone before the attempt, and answers `profileMissing` when it still cannot (sweep 2.11, 2026-11-09).
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/story-sign-in-with-google-dengan-allowlist-satu-akun-plan.md`
  summary: Verify on Preview that a non-allowlisted Google account sees "Akun ini nggak terdaftar" (hook message reaching error_description with the not_allowlisted marker).
  evidence: Unverified against real Supabase Auth; if the text does not pass through, rejected accounts see the network message (still no session).
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/story-app-shell-tema-dark-excel-sidebar-header-dan-toggle-tema-plan.md`
  summary: No component-rendering test harness, so Settings' "Not set" and first-load-failure branches (and other Server/Client Component rendering) are verified only by hand.
  evidence: Repo has vitest in node only (no jsdom/testing-library); add a harness when the first content surface (Dashboard) lands.

- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/story-bukti-ujung-ke-ujung-unduh-dari-production-finish-server-mem-plan.md`
  summary: Contract test that runs the real migration (grants, RLS, RPC parameter names) against the adapter's column and function names.
  evidence: 1.9 tests mock every Supabase client; a renamed parameter or dropped grant shows only as `proofRecorded: false` in Production. Build it with `attempts` in epic 2 (local Supabase or pgTAP); `bridge_proofs` is dropped then.
  status: done — `supabase/tests/contract.db.test.ts` applies every migration to Postgres 16 with a Supabase stub (grants, RLS, the in-progress index, the `received_at` trigger), `npm run test:db` and CI job `db-contract` (story 2.2, 2026-11-03).
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/story-bukti-ujung-ke-ujung-unduh-dari-production-finish-server-mem-plan.md`
  summary: Drop `bridge_proofs`, its RPC and `/dev/bridge-proof` once epic 2's `attempts` and `submit()` exist.
  evidence: Proof-only table and page (1.9 Design Notes).
  status: done — `/dev/bridge-proof`, `bridge-proofs.ts` removed and migration `20261102000002_drop_bridge_proofs.sql` drops the table and RPC (story 2.1 tracer, 2026-11-02).
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/story-bukti-ujung-ke-ujung-unduh-dari-production-finish-server-mem-plan.md`
  summary: Production logs "unstable value `Date.now()` while prerendering" on `/settings` and `/dev/bridge-proof` from supabase-js `_loadSession` in `getSessionUser`.
  evidence: Vercel runtime logs 2026-10-30 07:09–07:11 (deploy `dpl_gqdTPjsoZFdPpD2nzNBssV483EhS`), level error, pages still render; likely needs `await connection()` (or reading cookies first) before the session read under `cacheComponents`. Fix in the 1.10 refactor sweep.
- source_plan: `_bmad-output/initiative-excel-practice/epic-percobaan-kiriman-file/story-tracer-start-l1-p1-unduh-finish-file-received-plan.md`
  summary: Delete `attempt-files/<id>/` when an attempt row is deleted (compensation path, profile cascade).
  evidence: 2.1 review; no Storage delete policy or cleanup job, files become unreachable.
  status: moved — epic 3 (needs a Storage delete policy or cleanup job, which is new behaviour; retention of `submission-<n>` — including the orphan `submission-1` from 2.3 review #10 — is decided with grading, its first reader; one user, small volume) (sweep 2.11, 2026-11-09).
- source_plan: `_bmad-output/initiative-excel-practice/epic-percobaan-kiriman-file/story-tracer-start-l1-p1-unduh-finish-file-received-plan.md`
  summary: ExamStatus polling/auto-download loop and the template trace on the deployed `/levels` function have no automated check.
  evidence: 2.1 verification-gap lens; needs a DOM harness (epic 4) and a post-build trace check.
  status: moved — epic 4 for the loop (needs the DOM harness); trace done — `next.config.test.ts` checks `outputFileTracingIncludes["/levels"]`, and Start downloaded the file in Production (2.1) and Preview (2.9) (sweep 2.11, 2026-11-09).
- source_plan: `_bmad-output/initiative-excel-practice/epic-percobaan-kiriman-file/story-siklus-percobaan-ad-5-di-core-dan-tes-kontrak-db-plan.md`
  summary: The database does not fence service-role status writes against AD-5 (only the TS machine does); and abandoning a `received` attempt while grading runs makes the grader's compare-and-set come back `lost`.
  evidence: 2.2 review; decide a check trigger and the grader's `lost` handling with grading (epic 3).
  status: moved — epic 3 (the grader is the second service-role status writer; the check trigger and its `lost` handling are decided with it) (sweep 2.11, 2026-11-09).
- source_plan: `_bmad-output/initiative-excel-practice/epic-percobaan-kiriman-file/story-submit-penuh-lima-kode-ad-6-dan-batas-ukuran-plan.md`
  summary: Bounded inflate relies on JSZip's private `ZipObject#internalStream` (jszip 3.10.2 pinned) and checks the budget per chunk; revisit on any jszip upgrade.
  evidence: 2.3 review; a version bump could silently drop the zip-bomb guard.
  status: done — `read.test.ts` › "jszip pin (bounded inflate)" fails unless jszip is 3.10.2 and `ZipObject.prototype.internalStream` is a function ("periksa ulang bounded inflate sebelum menaikkan jszip") (sweep 2.11, 2026-11-09).
- source_plan: `_bmad-output/initiative-excel-practice/epic-percobaan-kiriman-file/story-layar-exam-lengkap-plan.md`
  summary: The Orbit Loader pause/play toggle (`data-paused`, label switch) and the button's absence under reduced motion after hydration have no automated test; neither have the ExamStatus tick/poll/slow-timer effects.
  evidence: 2.4 review (medium if wrong, unverified); add with the DOM test harness in epic 4.
  status: moved — epic 4 (DOM test harness) (sweep 2.11, 2026-11-09).
- source_plan: `_bmad-output/initiative-excel-practice/epic-percobaan-kiriman-file/story-upload-dropzone-dan-route-upload-plan.md`
  summary: Upload Dropzone interaction (focus return after a rejection, alert/status announcements, drag-over, keyboard activation, disabled input while uploading) has no automated test.
  evidence: 2.5 review (medium if wrong, unverified); add with the DOM test harness in epic 4.
  status: moved — epic 4 (DOM test harness) (sweep 2.11, 2026-11-09).
- source_plan: `_bmad-output/initiative-excel-practice/epic-percobaan-kiriman-file/story-level-detail-panel-level-1-plan.md`
  summary: Level Detail Panel has no "Start Test" once all practices are done, and no done state for a passed Test; the "Active" eyebrow is hard-coded.
  evidence: 2.6 review; unreachable until Test content and graded progress exist (epics 3–4) — add with them.
  status: moved — epic 4 (needs Test content (epic 5) and graded progress (AD-7); epic 4's Level Map wraps this panel) (sweep 2.11, 2026-11-09).
- source_plan: `_bmad-output/initiative-excel-practice/epic-percobaan-kiriman-file/story-konten-level-1-practice-1-plan.md`
  summary: Start's session `insert … select("id")` with column-level select grants and the service-role `update (snapshot) … select("id")` are verified only in SQL, not through PostgREST.
  evidence: 2.8 review (medium if wrong, unverified); a Preview Start after applying migration 20261104000001 to dev settles it.
  status: done — migration `20261104000001` is applied to dev and prod; in dev all six Preview attempts of 2026-11-06 (abandoned 3, graded 2 via SQL, open 1) have `snapshot` filled, so both PostgREST paths work (sweep 2.11, 2026-11-09).
- source_plan: `_bmad-output/initiative-excel-practice/epic-percobaan-kiriman-file/story-attempt-card-resume-abandon-dan-kunci-start-plan.md`
  summary: Abandon dialog behaviour (error slot, stale-error hiding, close on done, pending lock, focus trap and return) has no automated test.
  evidence: 2.7 review (medium if wrong, unverified); add with the DOM test harness in epic 4.
  status: moved — epic 4 (DOM test harness) (sweep 2.11, 2026-11-09).
- source_plan: `_bmad-output/initiative-excel-practice/epic-percobaan-kiriman-file/story-modfinish-pesan-per-kode-dan-tutup-workbook-plan.md`
  summary: The new macro messages (NOT_EXCEL, tlsFailed, tempFailed, saveFailed) are [ASSUMPTION] in `src/messages/id.ts` but have no row in EXPERIENCE.md › Message set.
  evidence: 2.9 review; add the rows with the next UX doc revision.
  status: done — EXPERIENCE.md › System message set has illustrative rows for Not an Excel file (Macro), Too large (Upload + macro), Macro TLS failed, Macro TEMP copy failed and Macro save failed, verbatim from `src/messages/id.ts`, whose comments point to them (sweep 2.11, 2026-11-09).
- source_plan: `_bmad-output/initiative-excel-practice/epic-percobaan-kiriman-file/story-submit-penuh-lima-kode-ad-6-dan-batas-ukuran-plan.md`
  summary: Storage and status writes of `submit()` are checked only through mocks (2.3 Review Triage Log #16, deferred to a manual `dev` check; recorded here by sweep 2.11).
  evidence: 2.3 review (low); the route tests mock `storeSubmissionFile` and `markReceived`.
  status: done — laptop check 2.9 in Preview (dev): submissions were accepted and the exam screen moved to received; each rejection code answered per attempt status (sweep 2.11, 2026-11-09).
