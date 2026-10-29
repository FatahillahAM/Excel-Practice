---
title: 'Sidik jari sumber VBA (AD-4) menggantikan hash vbaProject.bin'
type: 'feature'
ticket: '11'
created: '2026-10-29'
status: 'in-progress'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
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
- [ ] `src/adapters/workbook/vba.ts` -- `readVbaModuleHashes(vbaProjectBin)` → `Record<name, hex> | null`: pembaca CFB, dekompresi MS-OVBA, parse record `dir` (MODULENAMEUNICODE, MODULESTREAMNAME, MODULEOFFSET), normalisasi AD-4, SHA-256; `null` bila tak terbaca.
- [ ] `src/adapters/workbook/vba.test.ts` -- tiap baris I/O Matrix; golden: hasil dekompresi `modFinish` = `modFinish.bas` setelah normalisasi; chunk tak terkompresi + terkompresi > 4096 byte; CFB buatan writer `cfb` dengan stream modul di sektor reguler.
- [ ] `src/adapters/workbook/templates.ts` -- registry `{ file, vbaModules: { modFinish: hex } }` dan `matchesTemplate(hashes, version)`.
- [ ] `src/adapters/workbook/templates.test.ts` -- hitung ulang registry dari `.xlsm`; fixture S2 cocok; cek byte saat generate tetap.
- [ ] `src/adapters/workbook/read.ts` + `read.test.ts` -- `WorkbookReading.vbaModuleHashes` menggantikan `vbaProjectSha256`.
- [ ] `scripts/spike-s1.ts`, `scripts/spike-s2.ts` -- cek registry memakai `matchesTemplate`.

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
