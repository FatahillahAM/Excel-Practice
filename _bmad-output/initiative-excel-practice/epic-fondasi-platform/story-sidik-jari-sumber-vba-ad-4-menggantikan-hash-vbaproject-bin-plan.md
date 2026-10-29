---
title: 'Sidik jari sumber VBA (AD-4) menggantikan hash vbaProject.bin'
type: 'feature'
ticket: '11'
created: '2026-10-29'
status: done
route: 'full'
route_source: 'auto'
review: 'thorough'
review_source: 'auto'
lenses_ran: ['blind-hunter', 'edge-case-hunter', 'verification-gap', 'intent-alignment']
review_loop_iteration: 0
baseline_revision: '86a343613c631ab93508e0b929d0e725bf79a772'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Registry template dan `WorkbookReading` masih memakai SHA-256 byte `xl/vbaProject.bin`, padahal S2 membuktikan Excel menulis ulang file itu setiap kali menyimpan. Cek `IDENTITY_ALTERED` (AD-6) yang dibangun di atasnya akan menolak setiap kiriman asli.

**Approach:** Di `src/adapters/workbook`, baca `vbaProject.bin` sebagai MS-CFB, dekompresi stream `dir` dan sumber tiap modul per MS-OVBA §2.4.1, normalkan dan hash per modul persis seperti Rule AD-4, lalu kunci modul template yang tidak kosong di registry (v1: `modFinish`). Ganti hash byte di registry, `WorkbookReading`, tes, dan skrip spike.

**Decisions (user, 2026-10-29):**
- Pembaca MS-CFB memakai npm `cfb` 1.2.2 (dipin persis); writer-nya dipakai tes untuk stream besar di sektor reguler. Dekompresi MS-OVBA ditulis sendiri.

## Boundaries & Constraints

**Always:** normalisasi persis AD-4: byte hasil dekompresi tidak pernah di-decode jadi teks; CRLF dan CR tunggal jadi LF; baris yang diawali `Attribute VB_` dibuang; spasi dan tab di akhir baris dibuang; baris kosong di akhir dibuang; digabung LF tanpa LF akhir; kunci modul `MODULENAMEUNICODE`. Nilai registry hanya dihasilkan fungsi adapter dari `.xlsm` yang di-commit, hex huruf kecil, dan dihitung ulang di tes. Modul yang tidak dikunci diabaikan; VBA project hilang atau tak terbaca tidak pernah cocok.

**Never:** membandingkan byte `vbaProject.bin` untuk identitas (cek byte saat generate tetap boleh); endpoint, use case `submit`, atau kode penolakan (S3, epic 2); mengubah `exam.v1.xlsm`; mengubah perilaku patch atau pembacaan sel.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Template v1 | `exam.v1.xlsm` | hash per modul; `modFinish` sama dengan registry | — |
| Simpanan Excel | fixture S2 | hash `modFinish` sama dengan template walau byte `vbaProject.bin` beda | — |
| Modul kosong | modul dokumen hanya berisi `Attribute VB_*` | sumber ternormalisasi kosong; tidak dikunci; cocok tetap benar | — |
| Modul tambahan | sheet baru atau modul yang tidak dikunci | diabaikan, tetap cocok | — |
| Modul terkunci berubah | kode `modFinish` beda satu karakter | tidak cocok | — |
| Tanpa VBA | `.xlsx` atau `vbaProject.bin` hilang | hash per modul `null`; tidak cocok | — |
| VBA rusak | `vbaProject.bin` bukan CFB atau stream `dir` rusak | hash per modul `null`; tidak cocok | tidak melempar `NotAWorkbookError` |
| Multi-chunk | sumber modul > 4096 byte | dekompresi benar lintas chunk | — |

</frozen-after-approval>

## Code Map

- `src/adapters/workbook/read.ts` -- `WorkbookReading.vbaProjectSha256` dan `readVbaProjectSha256` diganti hash per modul.
- `src/adapters/workbook/templates.ts` -- registry `vbaProjectSha256` diganti modul terkunci.
- `src/adapters/workbook/template-patch.ts` -- `vbaProjectSha256` tetap untuk cek byte saat generate; jangan ubah patch.
- `src/adapters/workbook/templates.test.ts`, `read.test.ts` (baris 251, 264, 376), `template-patch.test.ts` -- tes yang memakai hash byte.
- `scripts/spike-s1.ts`, `scripts/spike-s2.ts` -- cek registry memakai hash byte.
- `assets/templates/vba/modFinish.bas` -- sumber acuan golden test dekompresi.
- `package.json` -- tambah `cfb` 1.2.2 (dipin). Container: npm `cfb` 1.2.2 (Apache-2.0, tipe disertakan, dependensi `adler-32`, `crc-32`, rilis terakhir 2022) terjangkau; oletools di venv scratchpad untuk cek silang.

## Tasks & Acceptance

**Execution:**
- [x] `src/adapters/workbook/vba.ts` -- `readVbaModuleHashes(vbaProjectBin)` → `Record<name, hex> | null`: pembaca CFB, dekompresi MS-OVBA, parse record `dir` (MODULENAMEUNICODE, MODULESTREAMNAME, MODULEOFFSET), normalisasi AD-4, SHA-256; `null` bila tak terbaca.
- [x] `src/adapters/workbook/vba.test.ts` -- tiap baris I/O Matrix; golden: hasil dekompresi `modFinish` = `modFinish.bas` setelah normalisasi; chunk tak terkompresi + terkompresi > 4096 byte; CFB buatan writer `cfb` dengan stream modul di sektor reguler.
- [x] `src/adapters/workbook/templates.ts` -- registry `{ file, vbaModules: { modFinish: hex } }` dan `matchesTemplate(hashes, version)`.
- [x] `src/adapters/workbook/templates.test.ts` -- hitung ulang registry dari `.xlsm`; fixture S2 cocok; cek byte saat generate tetap.
- [x] `src/adapters/workbook/read.ts` + `read.test.ts` -- `WorkbookReading.vbaModuleHashes` menggantikan `vbaProjectSha256`.
- [x] `scripts/spike-s1.ts`, `scripts/spike-s2.ts` -- cek registry memakai `matchesTemplate`.

**Acceptance Criteria:**
- Given `exam.v1.xlsm` dan fixture S2, when sidik jari dihitung, then keduanya cocok dengan registry v1 walau hash byte `vbaProject.bin` berbeda.
- Given `npm run test`, when dijalankan, then nilai registry dihitung ulang dari file yang di-commit dan sama dengan literal di `templates.ts`.

## Design Notes

Stream `dir` juga terkompresi MS-OVBA; offset sumber modul ada di record MODULEOFFSET, dan byte sebelum offset adalah cache p-code yang diabaikan. Cek silang hash dengan olevba/olefile di scratchpad dicatat di Implementation Notes.

## Verification

**Commands:**
- `npm run test` -- expected: semua lulus, termasuk hitung ulang registry dan fixture S2.
- `npm run lint` dan `npx tsc --noEmit` -- expected: bersih.
- `node scripts/spike-s1.ts` dan `node scripts/spike-s2.ts` -- expected: registry cocok untuk template dan fixture S2.

## Implementation Notes

- `src/adapters/workbook/vba.ts`: `readVbaModuleHashes` / `readVbaModuleSources` / `normalizeVbaSource` / `decompressVbaContainer`. Only an MS-CFB signature is accepted (npm `cfb` would also parse a zip or MIME container). Streams are looked up under the top-level `VBA` storage, case-insensitively, by MODULESTREAMNAME's Unicode name. Unreadable means `null`: bad CFB, no `VBA/dir`, malformed record, PROJECTMODULES count ≠ modules listed, a module without MODULENAMEUNICODE / stream name / MODULEOFFSET, duplicate module name, missing stream, MODULEOFFSET past the stream, malformed compressed container. Raw chunks must be exactly 4096 bytes (spec). Decompression is capped at 16 MiB per stream (six compressed bytes can expand to 4096), over the cap → `null`.
- `templates.ts`: `vbaModules` replaces `vbaProjectSha256`; `pinnedModules(hashes)` (non-empty modules) produces the registry value; `matchesTemplate(hashes, version)` throws for a version not in the registry or one that pins nothing (server bug, not user input).
- `read.ts`: `vbaModuleHashes`; an unreadable zip entry for `xl/vbaProject.bin` also gives `null` rather than throwing.
- `template-patch.ts` unchanged except its doc comment: `vbaProjectSha256` remains the generate-time byte check only.
- Test builders in `__fixtures__/vba-project.ts`: MS-OVBA compressor (greedy, optional raw chunks), `dir` writer, CFB via `cfb` writer.
- Registry v1: `modFinish` = `914687b34fc5eb2e3c3982861b567ccc25f040fb80543c3986e4935b80f4235c`; `ThisWorkbook`, `Sheet1`, `Sheet2` normalize to empty.
- Cross-check (scratchpad venv, oletools 0.60.x `olevba` `extract_macros`, the same normalization written in Python): for `exam.v1.xlsm` and `s2-excel2021.xlsm` every module hash equals ours (`modFinish` as above, document modules = SHA-256 of empty). `assets/templates/vba/modFinish.bas` normalized hashes to the same `modFinish` value. Byte SHA-256 of `vbaProject.bin`: template `d8aa9aa6…a9df`, S2 `9618df59…8ec4` (differ, as S2 found).
- Decompressor also checked against the MS-OVBA §3.2 no-compression and normal-compression examples.

## Review Triage Log

| # | Lens | Finding | Verdict | Evidence | Route |
|---|------|---------|---------|----------|-------|
| 1 | blind-hunter, edge-case-hunter (×2), verification-gap (other) | Decompression cap is per stream; many `dir` modules can alias one tiny bomb stream and every result is kept, and the duplicate-name check is O(n²) | medium | `readVbaModuleSources` calls `decompressVbaContainer` per module with the full 16 MiB each and stores all; verification-gap measured a 28 KB file holding ~545 MB. The cap's own comment says it exists to stop this | patch: one budget shared by `dir` and all modules, Set for names |
| 2 | blind-hunter | p-code ("VBA stomping") is not covered by the fingerprint and nothing says so | low | True: only source after MODULEOFFSET is hashed; Excel may run the cached p-code. p-code changes every save so it cannot be pinned (AD-4 design). Fix is one doc sentence | patch: state the limit in `vba.ts` header |
| 3 | blind-hunter | Code added to unpinned modules (ThisWorkbook events, a new module) passes, while `exam-bridge.md` says changed macro code means identity altered | low | Diff follows the intent ("kunci modul template yang tidak kosong") and AD-4 ("modules the template does not pin … are ignored"); grading reads formulas so harm is small. The tension sits between spine and spec, not in this change | defer |
| 4 | blind-hunter | MODULENAMEUNICODE treated as required; no MODULENAME fallback | low | Excel 2021 (the only producer here) writes it in both committed files; a fallback needs code-page decoding and new branches | reject (unlikely, fix adds branches) |
| 5 | blind-hunter | Decompressor accepts short non-final chunks (parser differential); `reserve(4096)` rejects a stream ending near a non-multiple cap | false | MS-OVBA §2.4.1.3.1 decompression also continues each chunk where the last ended, so VBE reads the same bytes; default cap is a multiple of 4096 and real sources are far below it | reject |
| 6 | blind-hunter | `spike-s1.ts` lost the "not recorded yet" path; README step 4 implies recording the fingerprint without `--template` | low | Without `--template`, an empty `vbaModules` makes `matchesTemplate` throw; `--template` prints the entry. README wording is the direct fix | patch: README names `--template` |
| 7 | blind-hunter | `spike-s2.ts` does not name a missing pinned module | low | Only the overall MISMATCH line shows; fixture is fixed and spike is dev-only | reject (unlikely, fix adds a branch) |
| 8 | blind-hunter | Unreadable VBA collapses every cause to `null` | low | True, but a reason channel adds public surface; nothing calls it on uploads yet | reject (fix adds surface) |
| 9 | blind-hunter, edge-case-hunter | Test compressor can write a chunk whose size overflows into the signature bits | low | `compressVba` has no `body.length <= 4096` check; no test hits it today. One-line throw | patch |
| 10 | blind-hunter | `read.test.ts` defines its own empty-source hash | low | Duplicates exported `EMPTY_MODULE_SHA256` | patch: use the export |
| 11 | verification-gap | Case-insensitive `findStream` never tested | low | Pre-verified: all fixtures use matching case | patch: add test |
| 12 | verification-gap | Unreadable `xl/vbaProject.bin` zip entry → `null` path untested | low | Pre-verified: no test corrupts the entry | patch: add test |
| 13 | verification-gap (other) | Spike scripts not in `npm test` | false | Same checks live in `templates.test.ts` | reject |
| 14 | intent-alignment | AD-6 submit path not exercised | false | Intent's Never excludes endpoint/`submit` (S3, epic 2) | reject |
| 15 | intent-alignment | Multi-chunk, raw-chunk and FAT paths only on synthetic projects from the in-house compressor | low | Real Excel modules here are < 4096 bytes; user chose the `cfb` writer for these tests; §3.2 examples give independent checks | reject (needs a real large Excel file) |
| 16 | intent-alignment | Byte hashing still in tests and spikes | false | Boundaries allow the generate-time byte check; none feeds identity | reject |
| 17 | intent-alignment | AD-4 "recomputed in CI" but the repo has no CI workflow | low | Pre-existing: no workflow runs `npm test`; Vercel build does not | defer |
| 18 | intent-alignment | Spine Deferred lines on the MS-CFB reader and the byte-hash code are stale | low | ARCHITECTURE-SPINE.md lines 268–269 describe the state before this change | patch |
| 19 | intent-alignment | `matchesTemplate` throws for unknown version; how AD-6 maps it is unshown | false | Documented: server bug, not user input; AD-6 caller is out of scope | reject |
| 20 | intent-alignment | `readWorkbook` returns null instead of throwing for unreadable VBA | false | Matches AD-6 ordering and the I/O matrix; tested | reject |
