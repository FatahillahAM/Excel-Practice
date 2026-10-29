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
