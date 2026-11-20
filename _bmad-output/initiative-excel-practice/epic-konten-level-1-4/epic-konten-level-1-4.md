---
type: epic
title: "Konten Level 1–4"
parent: initiative-excel-practice
covers: [CAP-6]
after: ["3.2", "3.4"]
assignee: ""
risk: medium
---

# Konten Level 1–4

## Description

Level 1–4 (Fondasi, Logika, Hitung bersyarat, Cari data) masing-masing punya 5 latihan dan 1 Test dengan bank skenario manufaktur, data acak tiap percobaan, kunci yang dihitung program, hint, dan Tips.

## Outcome

El Zavier bisa berlatih seluruh V1 dengan soal yang selalu baru; sinyalnya CAP-6 di spec dan Done when 1 initiative.

## Requirements

Dari SPEC.md CAP-6, content-generation.md dan level-curriculum.md:

- R1: dua attempt berturut-turut memakai data berbeda.
- R2: kunci jawaban sama dengan hitung ulang dari data.
- R3: instruksi hanya merujuk kolom dan entitas yang ada di data.
- R4: minimal 10 skenario per level.
- R5: 5 latihan + 1 Test per level, 100 poin per attempt.
- R6: hanya Office 2021 (tanpa LAMBDA, TEXTSPLIT, VSTACK/HSTACK, TAKE/DROP, GROUPBY/PIVOTBY).
- R7: teks Indonesia santai dengan nama Excel dalam bahasa Inggris, domain manufaktur saja.
- R8: fixture correct dan typed-values dinilai sesuai harapan di CI.

## Done when

1. Level 1–4 masing-masing punya 5 latihan + 1 Test dan minimal 10 skenario; dua percobaan berturut-turut memakai data berbeda dan kunci sama dengan hasil hitung ulang.
2. Setiap modul lulus validasi di CI: total poin 100 per percobaan, tanpa fungsi khusus Microsoft 365, fixture correct dan typed-values dinilai sesuai harapan.
3. Perintah soal, hint, dan Tips berbahasa Indonesia santai dengan nama Excel versi Inggris, dan hanya memakai domain manufaktur user.
4. Setiap item Level 1–4 bisa dimainkan dari Start sampai Results di Production.

## Boundaries

Konten Level 1–4 sebagai modul plug-in. Bukan: mesin, penilaian, atau UI (epic 2–4); Level 5–9 (epic 6).

## References

- parent — _bmad-output/initiative-excel-practice/initiative-excel-practice.md
- spec — _bmad-output/specs/spec-excel-practice/SPEC.md, CAP-6 dan Constraints
- curriculum — _bmad-output/specs/spec-excel-practice/level-curriculum.md
- content — _bmad-output/specs/spec-excel-practice/content-generation.md
- architecture — _bmad-output/planning-artifacts/architecture/architecture-excel-practice-2026-10-22/ARCHITECTURE-SPINE.md, sections AD-2, AD-3, AD-10; Consistency Conventions › Validation dan Testing

## Notes

- Decision: 5.1 selesai — Production dicek user; footer sidebar dibuat sticky (PR #36); disetujui: Test 6 soal, satu baca progres tambahan per halaman, teks "The Test for this level isn't ready yet.", "L{n}", "{n} of 9 levels passed", Tip Ctrl+Shift+L dan Alt+=, baris instruksi "Test ini tanpa batas waktu; lulus dengan skor 80." (user, 2026-11-20).
- Decision: plan 5.1–5.5 — semua asumsi dan rekomendasi disetujui: L01-T 6 soal; Table dinilai mulai 5.2; sidebar tampil 0 of 9 sejak sekarang; 4.7 dijalankan setelah 5.2; jatah hint L1–L4 = 3/2/1/0; fallback SMALL/LARGE/INDEX bila spill SORT/FILTER tidak tersimpan; aturan string kosong diputuskan dari fixture L02-P1; lint istilah Excel dengan allowlist (user, 2026-11-20).
- Decision: inception epic 5 — 6 tiket: tracer L01-T + perlengkapan Test (status Test tersimpan, hitungan level sidebar, penjelasan level tanpa Test); L01-P2..P5 + pemeriksa Excel Table/Sort-Filter; Level 2 + edge case penilaian; Level 3 + perbaikan operator spasi; Level 4 + akhir V1 + `<code lang="en">` + aturan Tip dobel; sapu bersih + CI semua item. Uji Production lewat 4.7 (user, 2026-11-20).
- Decision: fixture Excel hanya untuk tiap Test + 1 latihan per level (~8 item), sisanya dibuat kode; Test 6–8 soal gabungan keterampilan level, tanpa batas waktu, lulus ≥80; Table diperiksa strukturnya, Sort/Filter lewat hasil rumus; satu tiket per level; pekerjaan UI sidebar/status Test di 5.1; 4.7 jalan setelah 5.1 (user, 2026-11-20).
- Source conflict: Level 1 mencakup Excel Table dan Sort & Filter, tetapi `src/core/grading/checkers.ts` hanya punya pemeriksa sel, rumus dan nilai.

- Waits on epic-penilaian-hasil-tips because: butuh pemeriksa rumus di core dan penilaian dengan poin per soal.
- Decision: boleh berjalan paralel dengan epic-progres-streak-dashboard (user, 2026-10-23).
- Parked (dari epic 3, refactor sweep 3.10, 2026-11-19), diputuskan bersama konten yang pertama memakai bentuk itu:
  - `normalizeFormula` menghapus spasi di luar string, sehingga operator intersection (`$E$2:$E$13 $E:$E`) menggabung dua referensi dan `uses_reference` menggagalkan rumus yang sah (3.2); mengubah hasil penilaian.
  - Prefiks `_xludf.` tidak dibuang; `uses_functions` melaporkan fungsi hilang, bukan masalah `#NAME?` (3.2); mengubah teks alasan.
  - Sel rumus `t="str"` dengan cache kosong dibaca `""` dan mendapat `wrong_value`, bukan `not_calculated` (3.2; hanya penulis non-Excel); mengubah alasan.
  - Istilah Excel di alasan dan isi Tip belum dibungkus `<code lang="en">` (3.6); butuh markup di kontrak konten.
  - Dua soal dengan id Tip sama tampil sebagai dua Tips Card di Results (3.6); aturan satu kartu per soal dibekukan, tinjau ulang bila konten memakai ulang Tip.
  - Item Test yang dihapus dari registry kehilangan judul "Test passed / not passed" di Results/History (3.6); simpan jenis item bersama attempt/Result atau turunkan dari id saat item Test ada.
- Parked (dari epic 4, refactor sweep 4.6, 2026-11-20), dibangun bersama item Test pertama:
  - Level v1 tanpa item Test tetap aktif dengan Test "unavailable" tanpa penjelasan (4.1); hilang sendiri begitu tiap level punya Test.
  - App Sidebar: hitungan level di item Level Map ("L3") dan footer "levels passed of 9" (EXPERIENCE.md › App Sidebar; ditunda dari 4.5). Tanpa item Test belum ada level yang bisa lulus, jadi angkanya 0 of 9 untuk semua user sampai konten Test ada; ini UI di shell, bukan konten, tetapi baru bermakna setelah Test ada.
