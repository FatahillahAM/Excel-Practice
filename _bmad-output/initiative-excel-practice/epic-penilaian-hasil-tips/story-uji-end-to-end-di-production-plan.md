---
title: 'Uji end-to-end di Production'
type: 'feature'
ticket: '11'
created: '2026-11-18'
status: 'draft'
hitl: true
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md', '{project-root}/_bmad-output/initiative-excel-practice/epic-penilaian-hasil-tips/epic-penilaian-hasil-tips.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Done when 1–6 epic 3 sudah terbukti per entri (3.1–3.8 di Production, paritas di CI), tetapi belum pernah dijalankan berurutan di Production dengan bukti log; Try again belum pernah diuji langsung (3.3 menundanya ke entri ini) dan Tips & Tricks (3.9) belum pernah diuji di Production.

**Approach:** User menjalankan checklist Production di laptop (Excel 2021, macro aktif) dan lewat upload, satu baris per Done when; orchestrator membaca log runtime Vercel dan baris Supabase `prod` dalam satu jam setelah tiap langkah dan menyalinnya ke Implementation Notes. Kegagalan penilaian dipaksa untuk satu percobaan saja dengan langkah SQL orchestrator yang bisa dibalik, tanpa menyentuh status di luar transisi AD-5 aplikasi. Tidak ada perubahan kode produk: celah yang ditemukan menjadi story baru.

## Boundaries & Constraints

**Always:**
- Bukti hanya dari Production (`https://excel-practice-omega.vercel.app`, Supabase `prod`): baris log JSON (`attempt.started`, log kiriman `{attemptId, channel, code, received, duplicate}`, `hint.revealed`, `hint.refused`, `grading.done`, `grading.grade_threw`, `attempt.grading_retried`) dan baris `attempts`/`hint_reveals`.
- Vercel Hobby menyimpan log 1 jam: user melapor ke orchestrator segera setelah tiap langkah; orchestrator langsung menyalin log ke Implementation Notes.
- 3.9 (Tips & Tricks) sudah di-merge dan ter-deploy di Production sebelum langkah Tips & Tricks; langkah lain boleh jalan lebih dulu.
- Kegagalan paksa hanya untuk satu percobaan bernama (F), dengan izin user tepat sebelum SQL dijalankan; setiap SQL tulis memakai `where attempt_id = '<F>'` dan dibalik sebelum Try again. Status hanya berubah lewat aplikasi (`received → grading_failed → received → graded`), trigger pagar AD-5 tidak pernah dimatikan.
- Akhir checklist: tidak ada percobaan `open`, `received`, atau `grading_failed` di `prod`.

**Never:**
- Mengubah kode, migrasi, template, setting Vercel/Supabase; memperbaiki celah di entri ini (catat sebagai story baru).
- Mengubah status percobaan lewat SQL, atau menyentuh baris percobaan selain F.
- Menguji Fire Effect di Production (tidak ada item Test sampai epic 5; keputusan user 3.7 — cukup tes otomatis U9).
- Menandai epic `done` (keputusan user).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Macro semua benar | laptop, Finish file benar | `received` lalu `graded` < 15 s, Results muncul sendiri 100/100, 4 of 4 | gagal → catat log, story baru |
| Upload semua benar | file benar lewat Dropzone | sama dengan macro, skor dan alasan identik | — |
| Angka diketik | nilai hasil diketik di H2:H13 | soal 1 salah, alasan tertulis (bukan rumus/diketik) | — |
| Fungsi salah | J2 tanpa `SUM` | soal 3 salah, alasan menyebut fungsi yang diminta | — |
| Hint | 3 hint dibuka | jatah 3→0, tombol hint mati, skor = poin benar − 15, min 0 | hint ke-4 → `hint.refused` |
| Penilaian gagal | F dengan baris `hint_reveals` palsu ke-4 | `grading.grade_threw`, layar "Try again", Dropzone tersembunyi | baris palsu dihapus sebelum Try again |
| Try again | F `grading_failed`, baris palsu dihapus | `attempt.grading_retried` lalu `graded`, Results muncul | gagal lagi → stop, story baru |
| History / Tips & Tricks | percobaan uji `graded` | daftar + detail; koleksi dengan filter level dan pencarian | keadaan kosong dilihat sebelum percobaan pertama bila koleksi kosong, kalau tidak dari pencarian tanpa hasil |
| Log hilang | dilaporkan > 1 jam | bukti dari baris `prod` + teks layar/screenshot user | ulangi langkah bila tidak cukup |

</frozen-after-approval>

## Code Map

- `src/app/api/submissions/grading.ts` -- `runGrading` logs `grading.<reason>` then `grading.done {attemptId, channel, outcome, score}`.
- `src/core/grading/grade-attempt.ts` -- `grade_threw` → `grading_failed`; `file_missing`/`file_unreadable`/`snapshot_invalid` same path.
- `src/core/grading/grade.ts:21` -- `grade()` throws when `hintsUsed > snapshot.hintQuota`: the basis of the forced failure.
- `supabase/migrations/20261113000001_hint_reveals.sql` -- `hint_reveals` insert fence (open only, order, quota); no delete trigger; `service_role` has select only.
- `supabase/migrations/20261110000001_attempts_status_fence.sql` -- AD-5 fence; `grading_failed → received` resets `grading_restarts` and re-stamps `grading_requested_at`.
- `src/app/(app)/exam/[attemptId]/retry-actions.ts` -- Try again: `attempt.grading_retried`, `attempt.retry_grading_failed`.
- `src/app/(app)/exam/[attemptId]/hint-actions.ts` -- `hint.revealed {question, hintIndex, used}`, `hint.refused {code}`.
- `src/app/api/submissions/http.ts` -- one line per submission; `src/app/(app)/levels/start-actions.ts` -- `attempt.started`.
- Pages: `src/app/(app)/results`, `history`, `tips` (3.9). Model: `../epic-percobaan-kiriman-file/story-uji-end-to-end-di-production-dan-rilis-template-v1-plan.md` (2.12).

## Tasks & Acceptance

**Before the run (orchestrator):**
- [ ] Confirm Production serves `main` with 3.1–3.10 (and 3.9 before row 8); record deployment id.
- [ ] `prod`: `select id, status from attempts where status in ('open','received','grading_failed')` -- expected none (else ask the user to Abandon).

**Rumus L01-P1 yang benar** (data di baris 2 sampai baris data terakhir, misal 13; sesuaikan `13` dengan baris terakhir file Anda):
- Soal 1: `H2` `=E2*G2`, isi ke bawah sampai baris terakhir.
- Soal 2: `I2` `=E2*$L$2`, isi ke bawah.
- Soal 3: `J2` `=E2/SUM($E$2:$E$13)`, isi ke bawah.
- Soal 4: `O2` `=$N2*(1+O$1)`, isi ke `O2:R5`.
- Varian **angka diketik**: setelah file benar, salin `H2:H13` → Paste Special › Values (rumus hilang, angka tetap benar).
- Varian **fungsi salah**: `J2` `=E2/($E$2+$E$3+…+$E$13)` (hasil benar, tanpa `SUM`), isi ke bawah.

**Checklist Production (user, hitl).** Setelah tiap langkah, segera beri tahu orchestrator (log hanya disimpan 1 jam) dan tempel teks layar.

| # | Done when | Langkah user | Hasil yang diharapkan | Orchestrator memeriksa |
|---|-----------|--------------|-----------------------|------------------------|
| 1 | DW1 macro, DW4 | Laptop: Start L1 P1 (A), isi 4 rumus benar, Save, **Finish**. | Workbook tertutup, layar → "File received — grading…" → Results sendiri 100/100, 4 of 4, Tips 4 kartu, gerak skor 100. | `attempt.started` A; macro `received: true`; `grading.done` macro graded 100; row `graded`, `result.score` 100 |
| 2 | DW1 upload, DW2 diketik | Start (B), isi rumus benar lalu varian angka diketik di H, Save, **upload** di Dropzone. | Results: soal 1 salah dengan alasan tertulis, 75/100 (atau sesuai poin), suasana tenang. | upload `received: true`; `grading.done` upload graded; `result` soal 1 `correct:false` + `reasonText` |
| 3 | DW2 fungsi salah | Laptop: Start (C), rumus benar kecuali J (tanpa `SUM`), **Finish**. | Soal 3 salah, alasan menyebut `SUM`. | macro `received`; `grading.done`; `result` soal 3 `reasonText` |
| 4 | DW3, DW2 skor | Laptop: Start (F). Buka hint soal 1 tiga kali (atau 3 soal berbeda); coba hint ke-4. Isi rumus benar, Save, **jangan Finish dulu**. | Jatah 3→2→1→0, tombol hint mati / ditolak. | `hint.revealed` ×3 (`used` 1..3); `hint.refused`; `hint_reveals` 3 baris untuk F |
| 5 | DW4 gagal | Beri tahu orchestrator "siap paksa gagal F" dan setujui SQL langkah 5 (Design Notes). Setelah orchestrator konfirmasi, **Finish** F. | Layar "Try again", Dropzone tersembunyi, tanpa Results. | SQL insert 1 baris; macro `received`; `grading.grade_threw` + `grading.done` failed; row `grading_failed` |
| 6 | DW4 Try again, DW3 potongan | Orchestrator menghapus baris palsu dan konfirmasi; user klik **Try again**. | Results sendiri 85/100 (100 − 15), baris potongan hint tampil. | SQL delete 1 baris (3 tersisa); `attempt.grading_retried`; `grading.done` retry graded 85; `result.hintsUsed` 3 |
| 7 | DW5 History | Buka History: A, B, C, F tampil; buka satu → skor, waktu, soal salah + alasan, Tips. | Sesuai, dan detail cocok dengan Results. | page load tanpa `history.load_failed`/`history.result_invalid` |
| 8 | DW5 Tips & Tricks (setelah 3.9) | Buka Tips & Tricks: semua kartu yang pernah tampil; filter Level 1; cari kata dari satu Tip; cari kata ngawur → keadaan kosong. | Kartu dari A–F ada sekali per Tip, filter dan pencarian bekerja, keadaan kosong tampil. | tanpa error log; jumlah Tip unik dari `result` A–F |
| 9 | DW4 lambat (opsional) | Catat saja bila pesan penilaian lambat pernah muncul; tidak dipaksa. | — | — |

DW4 Fire Effect: tidak diuji di Production (U9, 3.7; epic 5). DW6 = baris 1–8 di Production. Akhir: tidak ada percobaan terbuka.

**After the run (orchestrator):**
- [ ] Fill the evidence table in Implementation Notes; one epic `Decision:` line (3.11 passed DW1–6, attempt prefixes, deployment). Gaps → new tickets via the user, not fixes.

**Acceptance Criteria:**
- Given rows 1–8 done, then every Done when has at least one Production log line or `prod` row in Implementation Notes, F has exactly its 3 real `hint_reveals` rows, and no attempt is open/received/grading_failed in `prod`.

## Implementation Notes

Evidence table (fill during the run, times UTC):

| # | Done when | Evidence (time · channel · event/code · attempt) | Deviation |
|---|-----------|--------------------------------------------------|-----------|
| 1 | DW1 macro, DW4 | | |
| 2 | DW1 upload, DW2 diketik | | |
| 3 | DW2 fungsi salah | | |
| 4 | DW3 | | |
| 5 | DW4 gagal | | |
| 6 | DW4 Try again | | |
| 7 | DW5 History | | |
| 8 | DW5 Tips & Tricks | | |
| DW6 | all on Production | | |

## Plan Change Log

## Review Triage Log

## Design Notes

**Forced grading failure (row 5).** `snapshot` is set-once and `attempts.status` writes outside AD-5 are refused, and grading finishes ~0.8 s after receipt, so racing a status or Storage change is unreliable. Deterministic instead: `grade()` throws when `hintsUsed > hintQuota` (3). With F `open` and its 3 real hints, the orchestrator adds one fake reveal in a single transaction (the insert fence is re-enabled before commit, so it is never off outside this statement):

```sql
begin;
alter table public.hint_reveals disable trigger hint_reveals_fence;
insert into public.hint_reveals (attempt_id, question_number, hint_index)
  select id, 4, 9 from public.attempts where id = '<F>' and status = 'open';
alter table public.hint_reveals enable trigger hint_reveals_fence;
commit;
```

Finish → `received` → `grade_threw` → `grading_failed` (app transition). Revert before Try again:
`delete from public.hint_reveals where attempt_id = '<F>' and question_number = 4 and hint_index = 9;` (expect 1 row). Try again (`grading_failed → received`) regrades with 3 hints → 85. Check after: `select count(*) from hint_reveals where attempt_id='<F>'` = 3. If the user declines the DDL, fallback: skip live Try again and record DW4's Try again as proven by the 3.3 tests only (user decision).

Prior evidence (3.1–3.8 Production lines in epic Notes) is background; Verify asks for this run's logs, so every Done when is rerun.

## Open Questions

1. **Forced-failure method.** (a) The one-transaction `disable trigger` + fake `hint_reveals` row on F, reverted by delete (deterministic; brief DDL on prod, only F affected). (b) No forced failure: Try again stays proven by tests only (Done when 4 partly unproven live). Recommended: (a).

## Verification

**Manual checks:**
- Supabase `prod`: `select status, count(*) from attempts where status in ('open','received','grading_failed') group by 1` -- expected no rows.
- `select count(*) from hint_reveals where attempt_id = '<F>'` -- expected 3; `select pg_get_triggerdef(oid), tgenabled from pg_trigger where tgname = 'hint_reveals_fence'` -- expected `O` (enabled).
- Implementation Notes: one row per checklist step with log lines (time, event/code, channel, attempt prefix).
