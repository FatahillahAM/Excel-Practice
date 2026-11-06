---
title: 'Setup Guide'
type: 'feature'
ticket: '10'
created: '2026-11-06'
status: 'in-progress'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
baseline_revision: 'a71989811cabdbe67327caf4065396dd1234ee53'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/setup-guide` masih `PlaceholderPage`, padahal tautan "Finish not working? Setup Guide" di layar exam mengarah ke sana. Tanpa panduan, setiap `.xlsm` unduhan membawa Mark of the Web dan macro-nya diblokir sampai di-Unblock satu per satu (S1), sehingga CAP-16 dan Done-when 5 epic belum terpenuhi.

**Approach:** Halaman server merender Setup Steps untuk Excel 2021: satu folder kerja tetap, browser menyimpan setiap `.xlsm` ke sana, folder itu dijadikan Trusted Location, Unblock bila masih diblokir; diakhiri arahan ke upload plus tautan "Resume" bila `loadOpenAttempt()` (2.7) menemukan percobaan berjalan. Uji laptop (hitl) membuktikan file baru di folder itu menjalankan Finish tanpa Unblock manual.

## Boundaries & Constraints

**Always:**
- Setup Steps sesuai EXPERIENCE.md › Setup Steps dan DESIGN.md › Setup Steps: daftar bernomor, nomor dalam lingkaran `primary`, path folder dan menu Excel bergaya `kbd` (`<kbd lang="en">`, menu persis seperti Excel English). Judul langkah English (chrome), isi langkah bahasa Indonesia santai `lang="id"`.
- Baris akhir verbatim: "Still blocked? Upload appears on the exam screen after Start"; tautan "Resume" ke `/exam/<id>` hanya bila ada percobaan `open`/`received`/`grading_failed`, dari pembacaan server yang sama dengan Dashboard dan /levels.
- Tidak ada pelacakan selesai ("Steps list; no completion tracking implied"); entrance sekunder `page-enter`.
- Klaim bahwa Trusted Location melewati blokir Mark of the Web belum terbukti di laptop: langkah Unblock tetap ada sebagai cadangan, dan uji laptop yang memutuskan.

**Never:**
- Setup Guide prompt di rail Dashboard (epic 4), perubahan `modFinish.bas`, template, atau `assets/templates/README.md` (entry 9); perubahan route atau `submit()`.
- Mengubah registry Windows, skrip `.reg`/PowerShell, atau saran mematikan pengaturan macro global (*Enable all macros*).
- Klien state, polling, atau DOM test harness (epic 4); migrasi.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Default | tanpa percobaan berjalan | judul "Setup Guide", 5 langkah bernomor, baris akhir tanpa "Resume" | — |
| Percobaan berjalan | `open` / `received` / `grading_failed` | baris akhir + tautan "Resume" → `/exam/<id>` | — |
| Baca gagal | `loadOpenAttempt()` → `"failed"` | panduan tetap tampil, tanpa "Resume", tanpa pesan error | sudah di-log |
| Dari layar exam | klik "Setup Guide" saat Finish tidak jalan | panduan + "Resume" kembali ke percobaan yang sama | — |
| Laptop, sesudah panduan | file baru dari Start disimpan browser ke folder kerja | Excel membuka tanpa bar merah "Microsoft has blocked macros…"; Finish mengirim | gagal → langkah Unblock, lalu upload |
| PC kantor | kebijakan IT memblokir macro | panduan mengarah ke upload di layar exam | — |

</frozen-after-approval>

## Code Map

- `src/app/(app)/setup-guide/page.tsx` -- `PlaceholderPage` today; becomes the guide.
- `src/app/(app)/open-attempt.ts` -- `loadOpenAttempt()` → `OpenAttempt | null | "failed"`; `attemptCardView(...).resumeHref` gives `/exam/<id>`.
- `src/app/(app)/dashboard/page.tsx` (+`page.test.tsx`) -- pattern: async server page, card classes `rounded-lg border border-border bg-card p-4`, mocking `loadOpenAttempt` and the Supabase adapters for `renderToStaticMarkup`.
- `src/components/shell/page-title.tsx`, `nav-items.ts` -- `PageTitle`, `surfaceTitle("Setup Guide")`, `page-enter`.
- `src/app/(app)/exam/[attemptId]/page.tsx` (+test) -- existing "Finish not working? Setup Guide" link; unchanged.
- DESIGN.md tokens `components.kbd` (`muted` bg, `input-border`, `typography.kbd` 11px mono) -- no `Kbd` or `Card` in `src/components/ui/` yet.
- `src/messages/id.ts` -- **not touched by 2.10** (step copy is instructional content, not a system message); entry 9 is editing it now, so if an implementer moves copy there anyway, merge with 2.9's `macroMessages` instead of overwriting.

## Tasks & Acceptance

**Execution:**
- [ ] `src/components/ui/kbd.tsx` -- shadcn-style `Kbd` (`<kbd lang="en">`, DESIGN.md `kbd` tokens) -- Setup Steps and later Tips Cards share it.
- [ ] `src/app/(app)/setup-guide/setup-steps.ts` -- `SETUP_STEPS`: `{ title, body }[]` where body parts are text or `{ kbd }`; `SETUP_FOLDER = "C:\\ExcelPractice"`; `STILL_BLOCKED = "Still blocked? Upload appears on the exam screen after Start"` -- one source for page and test. Steps (illustrative Indonesian bodies):
  1. "Make the working folder" -- buat folder `C:\ExcelPractice`; semua file latihan selalu di sini.
  2. "Save downloads there" -- di Chrome/Edge: `Settings > Downloads > Location > Change` ke folder itu (atau nyalakan "Ask where to save each file" dan pilih folder itu setiap Start).
  3. "Trust the folder in Excel" -- `File > Options > Trust Center > Trust Center Settings… > Trusted Locations > Add new location…`, pilih folder, centang "Subfolders of this location are also trusted", `OK`.
  4. "Open the file from the folder" -- buka `.xlsm` dari folder itu, bukan dari bar unduhan browser; klik **Finish** setelah selesai.
  5. "Unblock if Excel still blocks it" -- kalau muncul bar merah "Microsoft has blocked macros…": tutup Excel, klik kanan file → `Properties > General`, centang `Unblock`, `OK`, buka lagi.
- [ ] `src/app/(app)/setup-guide/setup-steps-list.tsx` -- server `<ol>` of cards, number in `primary` circle, title, body `lang="id"` with `Kbd`.
- [ ] `src/app/(app)/setup-guide/page.tsx` -- async: `PageTitle` "Setup Guide" in `page-enter`, `SetupStepsList`, then `STILL_BLOCKED` with a "Resume" `<Link>` to `resumeHref` when `loadOpenAttempt()` gives an attempt; `null`/`"failed"` → no link.
- [ ] `src/app/(app)/setup-guide/page.test.tsx` -- server render per matrix rows 1–3: `<h1>`, 5 `<li>` in order, folder path and Trust Center path inside `<kbd lang="en">`, bodies `lang="id"`, `STILL_BLOCKED` text, Resume `href="/exam/<id>"` for `open` and `received`, absent for `null` and `"failed"`; `kbd.tsx` renders `lang="en"`.

**Laptop (user, hitl) — checklist:**
1. Di Preview branch kerja, buka **Setup Guide** dan ikuti langkah 1–3 persis (folder `C:\ExcelPractice`, lokasi unduhan browser, Trusted Location).
2. Start L1 P1; pastikan file tersimpan langsung di `C:\ExcelPractice`. Klik kanan file → **Properties**: catat apakah ada kotak **Unblock** (bukti file membawa Mark of the Web). Jangan dicentang.
3. Buka file dari folder itu: catat bar apa yang muncul (tidak ada / kuning **Enable Content** / merah "blocked macros"). Klik **Finish**: harus terkirim dan layar exam pindah ke "File received — grading…".
4. Kontrol: Abandon di Dashboard, Start lagi, kali ini simpan file ke `Downloads` (di luar folder kerja) dan buka: bar merah diharapkan (bukti blokir aktif). Tutup tanpa Finish, Abandon.
5. Selama percobaan berjalan, buka Setup Guide: tautan **Resume** membuka layar exam yang sama. Tempel catatan langkah 2–4 ke chat.

**Acceptance Criteria:**
- Given the guide followed on the laptop, when a new file from Start is saved by the browser into the working folder and opened, then Finish sends it without a manual Unblock, while the same kind of file opened from outside the folder is still blocked.
- Given an attempt in progress, when the exam screen's "Setup Guide" link is followed, then "Resume" returns to that attempt.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).

## Plan Change Log

## Review Triage Log

## Design Notes

- Grounding: S1 (epic 1 plan, Implementation Notes) showed a downloaded file blocked ("Cannot run the macro … all macros may be disabled") until Unblock, and recorded "Unblock atau Trusted Location wajib"; only Unblock was tried there. Microsoft's article "Macros from the internet are blocked by default in Office" (learn.microsoft.com, microsoft-365-apps/security/internet-macros-blocked) checks Trusted Location before Mark of the Web, i.e. a file opened from a Trusted Location runs its macros; that page could not be fetched in this session (host not allowed), so laptop steps 2–4 are the proof. If step 3 still shows the red bar, return the plan (bad_plan): step 5 becomes required for every file and the Verify line fails.
- [ASSUMPTION] Folder `C:\ExcelPractice`, not under `Documents`: OneDrive often syncs `Documents`, and Trust Center treats such paths less predictably than a local folder; a root folder needs no admin rights.
- [ASSUMPTION] Browser setting covers Chrome and Edge only (the laptop's browser is not recorded); "Ask where to save" is the browser-neutral fallback.
- [ASSUMPTION] Step copy lives next to the page, not in `src/messages/id.ts` (not a system message; avoids colliding with entry 9).
- [ASSUMPTION] No shadcn `Card` added: card classes as on Dashboard; `Kbd` is added because Tips Cards need it too.
- [ASSUMPTION] On a read failure the guide renders without "Resume" and without an error: the guide is the point of the page.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: clean (if entry 9 is mid-rebuild, only its expected `vba.test.ts` golden may fail).

**Manual checks (if no CLI):**
- Preview at 390px and desktop, dark and light: numbered cards, `kbd` readable (≥3:1 border), Resume link present only with an attempt. Laptop checklist 1–5 with notes pasted into Implementation Notes.
