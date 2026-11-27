# Fixture Excel 2021 untuk Level 2

Hanya L02-P1 dan L02-T yang punya file Excel (rencana 5.3: fixture Excel hanya untuk Test dan satu latihan per level); L02-P2 sampai L02-P5 dinilai dari varian buatan kode di `l02-p2.ts` … `l02-p5.ts`.

Kedua file awal dibuat dengan `buildFixture("blank")` (seed 7, skenario `kemasan-karton-prima`), lewat
`WRITE_L02_BLANKS=<folder> npx vitest run src/content/levels/02-logika/__fixtures__/write-blanks.test.ts`,
lalu dikirim lewat chat; file itu tidak disimpan di repo. Sampai file di bawah di-commit, tes golden Excel 2021 L02-P1 dan L02-T di `golden.test.ts` dilewati dengan alasan "not committed yet". Bila hanya sebagian file satu item yang di-commit, tes golden gagal.

Di kedua file, sheet `Data` berisi 12 batch di A1:G13, dan batas di N2:O4: O2 = 1250 (Target Unit), O3 = 23 (Batas Unit Cacat), O4 = 10 (Batas Downtime (menit)).

# Fixture Excel 2021 untuk L02-P1 (IF)

Waktu sekitar 10 menit.

1. Simpan `l02-p1-blank.xlsm` ke folder mana saja. Buka di Excel 2021; bila ada **Protected View**, klik **Enable Editing**. Bar **Enable Content** boleh diabaikan. **Jangan klik Finish.**
2. Bila Excel menolak rumus ("There's a problem with this formula"), ganti setiap `,` dengan `;` lalu ketik ulang. Pastikan **Formulas → Calculation Options = Automatic**.
3. **File 1 — correct.** Di sheet `Data`, ketik di sel atas lalu salin ke bawah:
   - H2 `=IF(E2>=$O$2,"Capai","Kurang")` → Enter → pilih H2:H13 → **Ctrl+D** (H2 tampil Kurang, H3 Capai).
   - I2 `=IF(F2>$O$3,"NG","OK")` → pilih I2:I13 → **Ctrl+D** (I2 OK, I6 NG).
   - J2 `=IF(E2>$O$2,E2-$O$2,0)` → pilih J2:J13 → **Ctrl+D** (J2 0, J5 498).
   - K2 `=IF(G2>$O$4,"Cek mesin","")` → pilih K2:K13 → **Ctrl+D** (K2 dan K3 tampak kosong, K4 Cek mesin). Jangan hapus isi sel yang tampak kosong.
   - **File → Save As → Browse**, tipe `Excel Macro-Enabled Workbook (*.xlsm)`, nama `l02-p1-correct.xlsm` → Save.
4. **File 2 — typed-values.** Masih di file yang sama: pilih H2:H13 → **Ctrl+C** → **Home → Paste → Paste Values** (ikon 123) → Esc. Klik H2: formula bar menampilkan Kurang, bukan rumus. Save As `l02-p1-typed-values.xlsm`. Tutup Excel.
5. Jangan mengubah yang lain: tanpa judul kolom tambahan, tanpa sort/filter, tanpa sheet baru, tanpa menyisipkan baris atau kolom.

| File | Skor | Benar | Alasan |
|---|---|---|---|
| `l02-p1-correct.xlsm` | 100 | 4 of 4 | — |
| `l02-p1-typed-values.xlsm` | 75 | 3 of 4 | Q1 "Sel H2 berisi nilai yang diketik, bukan rumus." |

File `l02-p1-correct.xlsm` juga menjawab pertanyaan terbuka rencana 5.3: apakah Excel 2021 menyimpan hasil `""` sebagai `t="str"` dengan `<v>` kosong. Tes "Excel saved the answers as the README asks" memeriksa K2; bila Excel menyimpannya lain, tes itu gagal dan aturan string kosong ditinjau ulang.

# Fixture Excel 2021 untuk L02-T

Waktu sekitar 15 menit. Langkah 1–2 sama dengan L02-P1, dengan file `l02-t-blank.xlsm`.

3. **File 1 — correct.** Di sheet `Data`:
   - H2 `=IF(E2>=$O$2,"Capai","Kurang")` → Enter → pilih H2:H13 → **Ctrl+D** (H2 Kurang, H3 Capai).
   - I2 `=IF(AND(E2>=$O$2,F2<=$O$3),"Lolos","Tahan")` → pilih I2:I13 → **Ctrl+D** (I2 Tahan, I3 Lolos).
   - J2 `=IF(OR(F2>$O$3,G2>$O$4),"Ya","Tidak")` → pilih J2:J13 → **Ctrl+D** (J2 Tidak, J4 Ya).
   - K2 `=IFS(F2=0,"A",F2<=$O$3,"B",TRUE,"C")` → pilih K2:K13 → **Ctrl+D** (K2 B, K6 C, K7 A).
   - L2 `=IFERROR(E2/F2,"Tanpa Cacat")` → pilih L2:L13 → **Ctrl+D** (L2 72.8125, L7 Tanpa Cacat).
   - M2 `=IF(G2>$O$4,"Cek mesin","")` → pilih M2:M13 → **Ctrl+D** (M2 tampak kosong, M4 Cek mesin).
   - **File → Save As → Browse**, tipe `Excel Macro-Enabled Workbook (*.xlsm)`, nama `l02-t-correct.xlsm` → Save.
4. **File 2 — typed-values.** Masih di file yang sama: pilih H2:H13 → **Ctrl+C** → **Home → Paste → Paste Values** (ikon 123) → Esc. Klik H2: formula bar menampilkan Kurang. Save As `l02-t-typed-values.xlsm`. Tutup Excel.
5. **File 3 — wrong-function.** Buka `l02-t-correct.xlsm`. L2 ketik `=IF(F2=0,"Tanpa Cacat",E2/F2)` → pilih L2:L13 → **Ctrl+D** (L2 tetap 72.8125, L7 Tanpa Cacat). Save As `l02-t-wrong-function.xlsm`. Tutup Excel.
6. Jangan mengubah yang lain: tanpa judul kolom tambahan, tanpa sort/filter, tanpa sheet baru, tanpa menyisipkan baris atau kolom.

| File | Skor | Benar | Alasan |
|---|---|---|---|
| `l02-t-correct.xlsm` | 100 | 6 of 6 | — |
| `l02-t-typed-values.xlsm` | 85 | 5 of 6 | Q1 "Sel H2 berisi nilai yang diketik, bukan rumus." |
| `l02-t-wrong-function.xlsm` | 80 | 5 of 6 | Q5 "Rumus di L2 tidak memakai fungsi IFERROR." |

# Upload

Di GitHub buka `FatahillahAM/Excel-Practice`, branch `claude/laughing-shannon-vnoryl`, folder `src/content/levels/02-logika/__fixtures__/` → **Add file → Upload files** → seret kelima file → **Commit directly to the claude/laughing-shannon-vnoryl branch** → **Commit changes**. Beri tahu agent.
