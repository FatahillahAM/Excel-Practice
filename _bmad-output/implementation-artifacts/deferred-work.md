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
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/story-sidik-jari-sumber-vba-ad-4-menggantikan-hash-vbaproject-bin-plan.md`
  summary: AD-4 says registry values are recomputed in CI, but the repo has no CI workflow that runs npm test.
  evidence: no .github/workflows; Vercel only runs next build, so the registry recompute test runs only locally.
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/spike-s3-apakah-tombol-finish-bisa-mengirim-file-ke-https-dari-lap-plan.md`
  summary: POST /api/submissions/macro is public and runs readWorkbook on any body with no bound on inflated size, so a small zip bomb can exhaust the function.
  evidence: read.ts has no uncompressed-size or entry cap (pre-existing since S2); the spine defers the upload size limit to epic 2; bound inflated size and body size before or inside readWorkbook when submit() lands.
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/spike-s3-apakah-tombol-finish-bisa-mengirim-file-ke-https-dari-lap-plan.md`
  summary: Epic 2 modFinish follow-ups — map each AD-6 code to an Indonesian message box (rejection-codes.ts contract), give non-network hints for 413, TLS/certificate and local TEMP failures, and fix the TempCopyPath comment (always .xlsm).
  evidence: S3's modFinish shows the raw code and always blames the connection; any VBA edit needs a template rebuild and laptop run, so these ride the epic 2 VBA change.
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/spike-s3-apakah-tombol-finish-bisa-mengirim-file-ke-https-dari-lap-plan.md`
  summary: Mark when template v1 counts as released (before the first real attempt) so a later modFinish change ships as v2 instead of an in-place registry edit.
  evidence: S3 changed v1 in place twice because v1 was unreleased; nothing records or enforces the release point.
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/story-environment-dev-supabase-dev-preview-ke-dev-dan-migrasi-sql-plan.md`
  summary: AD-9 says every table has owner-only RLS and the browser never calls tables, but app_meta has a public select policy so the unauthenticated /health can read schema_version with the publishable key.
  evidence: /health has no session and the service-role client is limited to the macro path; either add a spine exception for non-user metadata (bmad-architecture) or read it differently once Google sign-in exists (entry 7).
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/story-sign-in-with-google-dengan-allowlist-satu-akun-plan.md`
  summary: A sign-in without a valid browser time zone succeeds but leaves no profiles row until a later sign-in, which AD-8 consumers (streaks, freezes) will assume exists.
  evidence: ensureProfile returns 'skipped' and the session lasts ~30 days; create or require the profile before the first AD-8 consumer lands (epic 3).
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/story-sign-in-with-google-dengan-allowlist-satu-akun-plan.md`
  summary: Verify on Preview that a non-allowlisted Google account sees "Akun ini nggak terdaftar" (hook message reaching error_description with the not_allowlisted marker).
  evidence: Unverified against real Supabase Auth; if the text does not pass through, rejected accounts see the network message (still no session).
- source_plan: `_bmad-output/initiative-excel-practice/epic-fondasi-platform/story-app-shell-tema-dark-excel-sidebar-header-dan-toggle-tema-plan.md`
  summary: No component-rendering test harness, so Settings' "Not set" and first-load-failure branches (and other Server/Client Component rendering) are verified only by hand.
  evidence: Repo has vitest in node only (no jsdom/testing-library); add a harness when the first content surface (Dashboard) lands.
