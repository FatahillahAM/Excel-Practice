---
title: 'submit() penuh: lima kode AD-6 dan batas ukuran'
type: 'feature'
ticket: '3'
created: '2026-11-03'
status: 'in-review'
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: '62c95aa2ee62fdd9488663fdcadb00bfc68c8ab6'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Route macro menjalankan AD-6 sendiri dan belum lengkap: content type tak dicek, modul tak dipin diabaikan, `ALREADY_GRADED`/`ATTEMPT_CLOSED` tak ada, file kiriman tak disimpan, body dan inflate tak dibatasi (zip bomb).

**Approach:** Use case core `submit(bytes, channel)` di `src/core/submission` dengan port (workbook, hash token, attempts, file) menjalankan urutan AD-6 persis. Route macro hanya membatasi body, merakit port service-role, dan memetakan hasil ke HTTP. Upload (entry 5) memanggil fungsi yang sama dengan port sesinya.

## Boundaries & Constraints

**Always:**
- Urutan AD-6 (1)→(5) persis; `WHE_TemplateVersion` tak pernah memilih versi.
- Core hanya `src/core/**` + `zod` (AD-1, dijaga lint); hash token, zip, DB, Storage lewat port.
- Header dibanding lewat SHA-256 kedua token. `channel: { kind: 'upload' }` tanpa cek header.
- Cocok template = semua modul dipin sama **dan** setiap modul tak dipin ternormalisasi kosong (AD-4).
- `open`: simpan `attempt-files/<id>/submission-1.xlsm` (`upsert: false`) lalu `markReceived` (CAS `submit_accepted`). Duplikat tidak menyimpan dan tidak mengganti file.
- Body > 4 MiB ditolak sebelum dibaca penuh; pembaca membatasi jumlah entri dan total byte inflate.
- Log JSON: `attemptId`, `channel`, `code`, `tokenSha256` (12 hex), `received`, `duplicate`; tanpa byte/token.

**Never:**
- Route/UI upload, policy Storage sesi, pesan ukuran di web (entry 5). modFinish dan rebuild template (entry 9).
- Kode baru di `RejectionCode` (memaksa bump `WHE_TemplateVersion`). Tabel `submissions`. Membandingkan byte `vbaProject.bin`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Diterima | xlsm sah, `open` | file tersimpan, `received`; 200 `{ok, data: {status: 'received', duplicate: false}}` | simpan gagal → 500, status tetap `open` |
| Duplikat | `received`/`grading_failed` | 200 `{status, duplicate: true}`; tanpa simpan | — |
| Bukan Excel | kosong, bukan zip, docx, XML rusak, zip bomb | 400 `NOT_EXCEL` | — |
| Identitas | `.xlsx`/`.xlsb`/`.xltm`/`.xlam` (content type main part); token hilang/salah bentuk/≠ header | 400 `IDENTITY_ALTERED` | — |
| Bukan percobaan | token tak dikenal | 400 `NOT_THIS_ATTEMPT` | — |
| Sidik jari | modFinish diubah, tanpa VBA, kode di modul tak dipin | 400 `IDENTITY_ALTERED`; status tetap | versi tak di registry → 500 |
| Status tutup | `graded` / `abandoned`, `closed` | 400 `ALREADY_GRADED` / `ATTEMPT_CLOSED` | — |
| Terlalu besar | body > 4 MiB (Content-Length atau stream) | 413 `FILE_TOO_LARGE` | — |
| Kalah CAS | status berubah setelah simpan | baca ulang lalu langkah (5) lagi | — |

</frozen-after-approval>

## Code Map

- `src/app/api/submissions/macro/{route,inspect}.ts` -- AD-6 (1)(2)(4) + lookup/received; `inspect.ts` dihapus.
- `src/adapters/workbook/read.ts` -- JSZip, inflate tanpa batas; wajib `xl/workbook.xml` (`.xlsb` kini `NOT_EXCEL`).
- `src/adapters/workbook/templates.ts` (+tes) -- modul tak dipin diabaikan. S3: ThisWorkbook/Sheet1–3 kosong, modFinish = registry (dicek 2026-11-03).
- `src/adapters/workbook/{vba,token,generate}.ts`, `__fixtures__/vba-project.ts` -- `EMPTY_MODULE_SHA256`, `tokenSha256(Hex)`, `ATTEMPT_TOKEN_RE`, `buildVbaProject`.
- `supabase/migrations/20261102000001_attempts.sql` -- bucket 5 MB, MIME xlsm; service role melewati RLS Storage, jadi tanpa migrasi.

## Tasks & Acceptance

**Execution:**
- [x] `src/core/submission/submit.ts` (+`index.ts`) -- `MAX_SUBMISSION_BYTES = 4 MiB`; `SubmissionFault` (`FILE_TOO_LARGE`, `INTERNAL_ERROR`, di luar `RejectionCode`); `Channel`; `SubmissionPorts`; `submit(bytes, channel, ports)` → hasil bertipe dengan field log. `ATTEMPT_TOKEN_RE` pindah ke core, `generate.ts` re-export.
- [x] `src/core/submission/submit.test.ts` -- port palsu: tiap baris matriks, urutan (dua alasan → kode langkah lebih awal), simpan sebelum CAS, `exists` → tetap CAS.
- [x] `src/adapters/workbook/read.ts` (+tes) -- `[Content_Types].xml` + main part dari `_rels/.rels`: bukan OOXML/tanpa main spreadsheet → `NotAWorkbookError`; spreadsheet non-macro-enabled `.xlsm` → `NotMacroEnabledError` sebelum sheet dibaca. Batas: ≤ 1 000 entri, ≤ 32 MiB inflate total, ukuran deklarasi tak dipercaya (inflate stream, berhenti melewati sisa anggaran) → `NotAWorkbookError`.
- [x] `src/adapters/workbook/templates.ts` (+tes) -- modul tak dipin wajib `EMPTY_MODULE_SHA256`; tes: modul standar tambahan dan kode di ThisWorkbook → tak cocok; sheet kosong baru dan S3 tetap cocok.
- [x] `src/adapters/workbook/submission.ts` (+tes) -- port workbook untuk core: `inspect(bytes)` → `not_excel | not_xlsm | xlsm {token, vba}`, `fingerprintMatches`, `hashToken`.
- [x] `src/adapters/supabase/attempts.ts` (+tes) -- di samping `findAttemptByTokenHash`/`markReceived`: `submissionFilePath(id, n)`; `storeSubmissionFile(service, id, n, bytes)` (pola `uploadGeneratedFile`) → `stored | exists | failed`.
- [x] `src/app/api/submissions/macro/route.ts` (+tes) -- `Content-Length` > batas → 413 tanpa baca; stream dibaca dengan batas; port service; HTTP 200 / 400 / 413 / 500; hapus `inspect.ts`. Tes lewat route: satu fixture per kode (termasuk `.xlsx`, `.xlsb`, modul tambahan, `graded`, `abandoned`, `closed`), duplikat, S3, body 4 MiB + 1 (dengan/tanpa Content-Length), zip bomb (banyak entri; satu entri nol besar).
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` -- tandai batas ukuran/zip bomb dan modul tak dipin selesai.

**Acceptance Criteria:**
- Given tes route macro dan core, when `npm run test`, then tiap kode AD-6, duplikat, batas ukuran, dan zip bomb lolos, dan `matchesTemplate` tidak mengubah hasil template v1 maupun S3.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).

## Plan Change Log

## Review Triage Log

Pass 1 (4 lenses): 0 high, 3 medium, 12 low, 1 false; patched 8, deferred 3, rejected the rest.

| # | Lens | Finding | Verdict | Route |
|---|------|---------|---------|-------|
| 1 | blind, edge | `exists` treated as `stored`: after a failed CAS, a re-post keeps the earlier unaccepted bytes | medium | patch: overwrite `submission-1` while the attempt is `open` |
| 2 | blind, edge | `reader.read()` rejection escapes POST (framework 500, no log line) | medium | patch: catch → 500 `INTERNAL_ERROR` with log |
| 3 | blind | New sheet modules with `Option Explicit` (Require Variable Declaration) fail the unpinned-empty rule | medium | patch: unpinned modules may hold only `Option …` lines; test |
| 4 | blind | Every `readWorkbook` error becomes `not_excel` silently | low | patch: log unexpected (non-`NotAWorkbookError`) errors |
| 5 | vg | Fault log event names untested | low | patch: assert event per fault row |
| 6 | blind | `storageErrorCode` drops `code` | low | patch |
| 7 | blind | Content-Length short-circuit test cannot fail | low | patch: assert pull count before and after POST |
| 8 | vg | `Duplicate` branch and thrown-error log untested | low | patch |
| 9 | blind | MS-OVBA decompression unbounded | false | `decompressVbaContainer` caps at `MAX_DECOMPRESSED_BYTES` (16 MiB) |
| 10 | blind | Orphan `submission-1` when the re-read finds abandoned/closed | low | defer (with 2.1 orphan-files entry) |
| 11 | blind | Macro contract changed without modFinish/template change | low | reject: entry 9 maps codes and 413 |
| 12 | blind | Upload channel has no session-scoped lookup | low | reject: entry 5 supplies session ports |
| 13 | blind, edge | Inflate budget checked per chunk; JSZip private `internalStream`; paused stream not released | low | defer: pin note on jszip upgrade; chunks are bounded |
| 14 | intent | 4 MiB enforced in route and core | low | reject: core guards upload too (entry 5) |
| 15 | blind | Over-budget message uses constant | low | reject: cosmetic |
| 16 | intent | Storage/status writes only checked through mocks | low | defer: manual `dev` check after deploy |

## Design Notes

- Core, bukan orchestrator app: AD-1/AD-6 menuntut satu aturan untuk dua channel; upload cukup merakit port sesi, tes core tanpa mock vendor. Byte `.xlsm` tetap di adapter (AD-4).
- Selalu `n = 1`: duplikat tak pernah menyimpan, jadi file pertama yang diterima = yang dinilai. `exists` (balapan, CAS gagal sebelumnya) lanjut ke CAS; file yatim bila Abandon jatuh di antara simpan dan CAS diterima.
- `FILE_TOO_LARGE` bukan kode AD-6: Vercel membalas 413 non-JSON di atas 4,5 MB, jadi VBA memetakan status HTTP (entry 9), tanpa bump template. Zip bomb = tak bisa dibaca → `NOT_EXCEL`.
- Semua penolakan tetap 400; modFinish menganggap sukses hanya 200 + `"ok":true`.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` -- expected: bersih.

**Manual checks:**
- Setelah deploy `dev`: Finish file L1 P1 → `received` dan `attempt-files/<id>/submission-1.xlsm` ada; Finish kedua → 200 `duplicate: true`, file tak berubah.
