---
title: 'Materi sebelum Practice'
type: 'feature'
ticket: '7'
created: '2026-11-27'
status: done
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/specs/spec-excel-practice/content-generation.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Halaman Practice hanya menampilkan soal (lewat file Excel). Untuk pemula itu berat: tidak ada panduan atau materi yang bisa dibaca sebelum mulai.

**Approach:** Setiap Practice punya bagian **Materi**: 2–4 kartu pendek (konsep, contoh rumus kecil, langkah klik di Excel). Materi tampil sebelum tombol Start di Level Detail Panel dan bisa dibuka lagi dari layar Exam selama attempt berjalan. Materi statis per item (tidak tergantung seed), tidak dinilai, tidak disimpan di snapshot, tanpa migrasi. Kontrak `LevelItem` diperluas dan `defineLevelModule` menolak Practice tanpa materi. L01-P1..P5 diberi materi di tiket ini; Level 2–4 (5.3–5.5) menulis materi sejak awal.

## Boundaries & Constraints

**Always:**
- Tipe dan skema materi di `src/core/content/level-module.ts`; isi di `src/content/levels/*` (AD-1: core tidak meng-import content; AD-2: satu kontrak `LevelModule`; AD-10: konten di kode).
- Practice wajib 2–4 kartu; Test tidak boleh punya materi. Validasi saat modul dimuat, sama seperti Tip.
- Teks R7: Indonesia santai, nama Excel bahasa Inggris, contoh domain manufaktur; tanpa fungsi khusus M365 (R6, cek `addM365Issue` yang sama dengan Tip).
- `lang="id"` pada isi kartu; rumus/menu/tombol keyboard sebagai `<code lang="en">` / `<kbd lang="en">` (EXPERIENCE.md › Voice and Tone). Chrome tetap English ("Start Practice 1").
- Materi tidak membocorkan jawaban persis soal (contoh memakai sel/angka lain dari soal), sama seperti hint terakhir tidak memberi rumus utuh.
- `contentVersion` L01 naik (AD-10).

**Never:**
- Kolom/tabel DB, tracking "sudah dibaca", gating Start pada materi, poin.
- Materi di `ExamSnapshot` atau di workbook `.xlsm`.
- Materi untuk Test (L01-T) atau konten Level 2–4.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Practice tanpa materi | `LevelItem` kind practice, `materi` kosong/hilang | `defineLevelModule` throw, pesan menyebut item id | gagal saat load/tes |
| Jumlah kartu salah | 1 atau 5 kartu | ditolak (2–4) | — |
| Test dengan materi | kind test + `materi` | ditolak | — |
| Fungsi M365 di materi | mis. `TEXTSPLIT` di body | ditolak (R6) | — |
| Panel level, Practice berikutnya | L01 terbuka, P1 next | bagian Materi tampil di atas tombol "Start Practice 1" | — |
| Practice selesai / lain | row "Practice again" | Materi tetap bisa dibuka per row | — |
| Attempt berjalan | layar Exam L01-P2 | tombol "Materi" membuka materi P2 | item tak dikenal → tombol tidak tampil |
| Attempt Test | layar Exam L01-T | tidak ada tombol Materi | — |
| Phone | bottom sheet panel | Materi bisa dibaca (Start tetap diblok di phone) | — |

</frozen-after-approval>

## Code Map

- `src/core/content/level-module.ts` -- `LevelItem` (l.72), `tipSchema` (l.179, pola untuk `materiCardSchema`), `addM365Issue`, `levelModuleSchema`, `defineLevelModule` (l.426). Tip hidup per soal di `GeneratedExam`/snapshot (AD-9); materi beda: field statis di `LevelItem`.
- `src/core/content/level-module.test.ts`, `src/core/content/__fixtures__/levels.ts` -- `FIXTURE_LEVELS` perlu materi agar fixture tetap valid.
- `src/content/levels/01-fondasi/practice-1.ts`..`practice-5.ts` (+`*.test.ts`) -- `TIPS` per file; tambah `MATERI`. `index.ts` -- `contentVersion`.
- `src/content/levels/index.ts` -- `itemView()` (l.61) dipakai layar Exam; tambah `materi`.
- `src/app/(app)/levels/level-panel.ts` -- `PanelPractice` (l.17) membawa materi.
- `src/app/(app)/levels/level-detail-panel.tsx` -- rows + foot `StartControl` (l.153, l.272); Materi ditaruh sebelum Start.
- `src/app/(app)/exam/[attemptId]/page.tsx` (l.59–68) -- tombol Materi dekat `ExamStatus`/`HintPanel`.
- `src/components/ui/sheet.tsx`, `kbd.tsx` -- komponen yang ada; Tips Card style di DESIGN.md l.521 (`tips-list.tsx` sebagai acuan render).
- Tes DOM: `level-detail-panel.dom.test.tsx`, `exam/[attemptId]/hint-panel.dom.test.tsx` (jsdom, `@/test/dom`, Testing Library, `vi.mock` start-actions).

## Tasks & Acceptance

**Execution:**
- [ ] `level-module.ts` (+test) -- `materiCardSchema` {`id` kebab, `title`, `concept`, `example` {`formula`, `note`}, `steps` 1–5, `shortcuts` (`SHORTCUT_RE`)}; `LevelItem.materi?`; aturan practice 2–4 / test none; id unik per level; cek M365.
- [ ] `core/content/__fixtures__/levels.ts` -- materi minimal di fixture practice.
- [ ] `src/components/materi/materi-cards.tsx` -- render kartu (Tips Card style, `lang="id"`, `<code lang="en">`, `<kbd>`).
- [ ] `levels/level-panel.ts`, `level-detail-panel.tsx` (+dom test) -- Materi per Practice di atas Start (lihat OQ1).
- [ ] `content/levels/index.ts` `itemView`, `exam/[attemptId]/page.tsx` (+dom test) -- tombol "Materi" membuka Sheet, Practice saja.
- [ ] `01-fondasi/practice-1..5.ts` (+tests), `index.ts` -- materi L01-P1..P5, bump `contentVersion`.

**Acceptance Criteria:**
- Given a Practice without materi, when its module loads, then `defineLevelModule` throws naming the item.
- Given L01 open with P1 next, when the Level Detail Panel renders, then the Materi section precedes the "Start Practice 1" button in DOM order.
- Given an open L01-P3 attempt, when the user opens Materi on the Exam screen, then the P3 cards show; an L01-T attempt shows no Materi control.

## Design Notes

Kartu = judul · konsep (1–2 kalimat) · contoh rumus · langkah klik · shortcut. Contoh **L01-P1** (mengajarkan bentuk, bukan jawaban sel soal):

1. **Rumus dimulai dengan `=`** — Rumus menghitung dari sel lain, jadi hasilnya ikut berubah kalau datanya ganti. Contoh: `=E2*G2` = Unit Diproduksi × Biaya per Unit. Langkah: klik sel hasil → ketik `=` → klik E2 → ketik `*` → klik G2 → Enter. Jangan ketik angkanya manual.
2. **Referensi relatif vs absolut (`$`)** — Saat rumus di-copy ke bawah, `E2` ikut bergeser jadi `E3`, `E4`. Sel yang harus tetap (misal tarif di `$L$2`) dikunci pakai `$`. Contoh: `=E2*$L$2`. Langkah: ketik rumus → taruh kursor di `L2` → tekan <kbd>F4</kbd> sampai jadi `$L$2` (laptop: <kbd>Fn</kbd>+<kbd>F4</kbd>).
3. **Porsi dari total dengan `SUM`** — Porsi = nilai satu baris ÷ total semua baris; range total dikunci supaya tidak bergeser. Contoh: `=E3/SUM($E$2:$E$10)`. Langkah: ketik `=E3/SUM(` → blok E2:E10 → <kbd>F4</kbd> → `)` → Enter → `Home > Percent Style` (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>%</kbd>).
4. **Referensi campuran & isi cepat** — Di tabel dua arah, kunci kolom judul kiri (`$N2`) dan baris judul atas (`O$1`): `=$N2*(1+O$1)`. Langkah: isi sel kiri-atas → blok range sampai bawah → <kbd>Ctrl</kbd>+<kbd>D</kbd> (isi ke bawah); blok ke kanan → <kbd>Ctrl</kbd>+<kbd>R</kbd> (isi ke kanan).

Outline P2–P5 (judul kartu):
- **P2** Excel Table: Ctrl+T dan "My table has headers" · structured reference `Table1[Kolom]` · SUM/COUNTA/MAX pada kolom Table · AutoSum (Alt+=).
- **P3** Sort lewat rumus: SORT naik/turun (`1`/`-1`) · SORTBY urut berdasarkan kolom lain · spill (cukup satu sel, jangan isi bawahnya; error #SPILL!).
- **P4** Filter lewat rumus: FILTER dengan satu syarat (`=`, `>`) · COUNTIF teks dan `">"&sel` · syarat diambil dari sel, bukan diketik.
- **P5** Referensi campuran: `$B2*C$1` tabel dua arah · bagi dengan MAX kolom (`C$2:C$6`) · total berjalan `SUM($N$2:N2)` + fill.

- [ASSUMPTION] Materi statis per item cukup; data acak tiap seed tidak perlu tercermin di contoh.
- [ASSUMPTION] Label bagian "Materi" dipakai apa adanya (kata user, seperti "Ujian Akhir"); tombol Start tetap English "Start Practice N" sesuai EXPERIENCE.md, bukan "Mulai Practice".
- [ASSUMPTION] Tip yang sudah ada (F4, Ctrl+D) boleh tumpang tindih dengan materi; Tip tetap muncul di Results.
- [ASSUMPTION] Hint tetap berbayar (−5); materi gratis tetapi umum, jadi hint masih berguna.

## Open Questions

- Inline atau dialog? Rekomendasi: di panel, satu baris "Materi · 4 kartu" yang membuka `Sheet` (panel sudah sempit / bottom sheet di phone); di Exam, tombol yang sama membuka `Sheet` yang sama.
- Lacak materi dibaca? Rekomendasi: tidak (tanpa migrasi, tanpa gating; AD-7).
- Test juga dapat materi? Rekomendasi: tidak — Test menguji tanpa bantuan; skema menolaknya.
- Materi di sheet Instructions `.xlsm` juga? Rekomendasi: tidak di tiket ini (batas baris `INSTRUCTIONS_CELLS`).
- Tampil otomatis terbuka untuk Practice pertama kali? Rekomendasi: tidak; cukup baris Materi yang menonjol di atas Start.

## Verification

**Commands:**
- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build` -- expected: all pass.

**Manual checks:**
- /levels L01: Materi P1 terbaca sebelum Start; buka lagi dari layar Exam selama attempt P1; phone bottom sheet terbaca.

## Plan Change Log

- 2026-11-27 (implementation): P5 card 1 uses `=$A2*B$1`, not the outline's `$B2*C$1`, which is L01-P5 Question 1's exact formula (the "no exact answer" rule wins).
- 2026-11-27 (implementation): the L01-P1 sample is kept word for word as approved, split into the card fields (concept · example + note · steps · shortcuts). Its examples `=E2*G2`, `=E2*$L$2` and `=$N2*(1+O$1)` are P1's own Question 1, 2 and 4 formulas; this is flagged for the owner, not changed.
- 2026-11-27 (implementation): inline markup in Materi text: `` `…` `` renders as `<code lang="en">` and `[[Key]]` as `<kbd>` (validated against `SHORTCUT_RE`). The example `formula` must start with `=`.
- 2026-11-27 (implementation): `SheetContent` gains `side="right"` (from the right at `sm`, a bottom sheet on a phone) and `closeLabel`. The next Practice's Materi is its own row directly above Start; the other practices carry a Materi link in their table row.
