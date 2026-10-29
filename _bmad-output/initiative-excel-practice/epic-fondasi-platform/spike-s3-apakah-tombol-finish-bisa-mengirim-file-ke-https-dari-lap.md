---
id: 4
type: spike
title: "S3: Apakah tombol Finish bisa mengirim file ke HTTPS dari laptop?"
parent: epic-fondasi-platform
covers: [S3]
after: [1, 2, 11]
hitl: true
risk: high
refined: true
---

# S3: Apakah tombol Finish bisa mengirim file ke HTTPS dari laptop?

## Description

Menambahkan endpoint `POST /api/submissions/macro` di Production yang menerima bytes file dan header `X-Attempt-Token`, lalu mencatat ukuran, token, dan apakah sidik jari VBA file cocok dengan registry (entry 11). Menulis VBA Finish (SaveCopyAs + ServerXMLHTTP) di `modFinish` yang mengirim ke `WHE_ServerUrl` dan menampilkan status. `exam.v1.xlsm` diganti di tempat karena v1 belum dirilis, dan sidik jari registry v1 dihitung ulang.

## Acceptance Criteria

Verify: Dari Excel 2021 di laptop, Finish mengirim file ke Production dan menampilkan pesan terkirim; log server mencatat ukuran, token yang sama, dan sidik jari cocok, juga setelah user menambah sheet dan membuka VBA editor sebelum Finish; tanpa jaringan Finish menampilkan pesan gagal dengan workbook tetap terbuka.

## References

- parent — _bmad-output/initiative-excel-practice/epic-fondasi-platform/epic-fondasi-platform.md
- _bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md, sections AD-4, AD-6, AD-13, Required Spikes (S3)

## Notes

- Open question: Apakah antivirus atau kebijakan Windows memblokir ServerXMLHTTP dari Excel.
- Decision: pekerjaan sidik jari VBA dipisah ke entry 11 sebelum S3 (user, 2026-10-29).
- Decision: S3 mengubah `exam.v1.xlsm` di tempat karena v1 belum dirilis; sidik jari registry v1 dihitung ulang (user, 2026-10-29).
