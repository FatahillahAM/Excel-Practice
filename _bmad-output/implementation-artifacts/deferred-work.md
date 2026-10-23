# Deferred Work

- source_plan: `/home/user/Excel-Practice/_bmad-output/initiative-excel-practice/epic-fondasi-platform/story-tracer-scaffold-with-supabase-ter-deploy-ke-vercel-productio-plan.md`
  summary: Catat versi seed (next 16.4.2, react 19.3.1, typescript 5.9.3, @supabase/ssr 0.12.7, @supabase/supabase-js 2.118.0, tailwindcss 4.3.3, eslint-config-next 16.4.2, Node 24.x) di Notes epic fondasi lewat bmad-preview-ticketing.
  evidence: Field `unknown` entry 1 meminta versi seed dicatat di Notes epic, tetapi bmad-build tidak boleh menulis file tiket; versinya saat ini hanya ada di Implementation Notes plan.
- source_plan: `/home/user/Excel-Practice/_bmad-output/initiative-excel-practice/epic-fondasi-platform/spike-s1-apakah-template-xlsm-yang-di-patch-tetap-utuh-di-excel-20-plan.md`
  summary: Buktikan bahwa `xl/vbaProject.bin` tetap byte-identik setelah Excel 2021 membuka, menjalankan Finish, dan menyimpan file hasil patch, sebelum cek `IDENTITY_ALTERED` (AD-6) dibangun di S3 atau epic 2.
  evidence: Unverified, high bila benar. S1 hanya menguji membuka tanpa menyimpan. Bila Excel menulis ulang `vbaProject.bin` saat save (misalnya cache kode terkompilasi), setiap kiriman asli akan ditolak. Terjawab dengan membandingkan SHA-256 `vbaProject.bin` file yang disimpan Excel dengan registry (`d8aa9aa6…a9df`).
