# Fixture Excel 2021 untuk L01-P1

File awal `l01-p1-blank.xlsm` dibuat dengan `buildFixture("blank")` (seed 7, skenario `baut-sinar-presisi`) dan dikirim lewat chat; file itu tidak disimpan di repo. Waktu sekitar 15 menit.

1. Simpan file ke folder mana saja (misalnya `Documents\fixture`). Buka di Excel 2021; bila ada **Protected View**, klik **Enable Editing**. Bar **Enable Content** boleh diabaikan. **Jangan klik Finish.**
2. Bila Excel menolak rumus ("There's a problem with this formula"), ganti setiap `,` dengan `;` lalu ketik ulang. Desimal bisa tampil dengan koma (`0,092461`); itu sama.
3. **File 1 — correct.** Di sheet `Data`, ketik di sel atas lalu salin:
   - H2 `=E2*G2` → Enter → pilih H2:H13 → **Ctrl+D** (H2 tampil 1302148.09).
   - I2 `=E2*$L$2` → pilih I2:I13 → **Ctrl+D** (I2 149511).
   - J2 `=E2/SUM($E$2:$E$13)` → pilih J2:J13 → **Ctrl+D** (J2 ≈ 0.092461).
   - O2 `=$N2*(1+O$1)` → pilih O2:R2 → **Ctrl+R** → pilih O2:R5 → **Ctrl+D** (O2 1168.4504, R5 1318.394).
   - Pastikan **Formulas → Calculation Options = Automatic**. **File → Save As → Browse**, tipe `Excel Macro-Enabled Workbook (*.xlsm)`, nama `l01-p1-correct.xlsm` → Save.
4. **File 2 — typed-values.** Masih di file yang sama: pilih H2:H13 → **Ctrl+C** → **Home → Paste → Paste Values** (ikon 123) → Esc. Klik H2: formula bar menampilkan angka, bukan rumus. Save As `l01-p1-typed-values.xlsm`. Tutup Excel.
5. **File 3 — wrong-function.** Buka `l01-p1-correct.xlsm`. J2 ketik `=E2/(AVERAGE($E$2:$E$13)*COUNT($E$2:$E$13))` → pilih J2:J13 → **Ctrl+D** (J2 tetap ≈ 0.092461). Save As `l01-p1-wrong-function.xlsm`. Tutup Excel.
6. Jangan mengubah yang lain: tanpa judul kolom, tanpa sort/filter, tanpa sheet baru, tanpa menyisipkan baris atau kolom.
7. Di GitHub buka `FatahillahAM/Excel-Practice`, branch `claude/laughing-shannon-vnoryl`, folder `src/content/levels/01-fondasi/__fixtures__/` → **Add file → Upload files** → seret ketiga file → **Commit directly to the claude/laughing-shannon-vnoryl branch** → **Commit changes**. Beri tahu agent.

| File | Skor | Benar | Alasan |
|---|---|---|---|
| `l01-p1-correct.xlsm` | 100 | 4 of 4 | — |
| `l01-p1-typed-values.xlsm` | 80 | 3 of 4 | Q1 "Sel H2 berisi nilai yang diketik, bukan rumus." |
| `l01-p1-wrong-function.xlsm` | 75 | 3 of 4 | Q3 "Rumus di J2 tidak memakai fungsi SUM." |


# Fixture Excel 2021 untuk L01-T

File awal `l01-t-blank.xlsm` dibuat dengan `buildFixture("blank")` dari `l01-t.ts` (seed 7, skenario `baut-sinar-presisi`) dan dikirim lewat chat; file itu tidak disimpan di repo. Sampai ketiga file di bawah di-commit, tes golden L01-T (Excel 2021) di `golden.test.ts` dilewati dengan alasan "not committed yet". Waktu sekitar 20 menit.

1. Simpan file ke folder mana saja. Buka di Excel 2021; bila ada **Protected View**, klik **Enable Editing**. Bar **Enable Content** boleh diabaikan. **Jangan klik Finish.**
2. Bila Excel menolak rumus ("There's a problem with this formula"), ganti setiap `,` dengan `;` lalu ketik ulang. Desimal bisa tampil dengan koma (`0,059707`); itu sama.
3. **File 1 — correct.** Di sheet `Data`, ketik di sel atas lalu salin:
   - H2 `=E2-F2` → Enter → pilih H2:H13 → **Ctrl+D** (H2 tampil 688, H13 850).
   - I2 `=H2-$N$2` → pilih I2:I13 → **Ctrl+D** (I2 -272, I13 -110).
   - J2 `=H2/SUM($H$2:$H$13)` → pilih J2:J13 → **Ctrl+D** (J2 ≈ 0.059707, J13 ≈ 0.073766).
   - K2 `=RANK.EQ(H2,$H$2:$H$13)` → pilih K2:K13 → **Ctrl+D** (K2 11, K13 7).
   - R2 `=$Q2*(1+R$1)` → pilih R2:U2 → **Ctrl+R** → pilih R2:U5 → **Ctrl+D** (R2 1168.4504, U5 1426.2626).
   - N4 `=MAX(H2:H13)` → Enter (N4 1505).
   - Pastikan **Formulas → Calculation Options = Automatic**. **File → Save As → Browse**, tipe `Excel Macro-Enabled Workbook (*.xlsm)`, nama `l01-t-correct.xlsm` → Save.
4. **File 2 — typed-values.** Masih di file yang sama: pilih H2:H13 → **Ctrl+C** → **Home → Paste → Paste Values** (ikon 123) → Esc. Klik H2: formula bar menampilkan angka (688), bukan rumus. Save As `l01-t-typed-values.xlsm`. Tutup Excel.
5. **File 3 — wrong-function.** Buka `l01-t-correct.xlsm`. N4 ketik `=LARGE(H2:H13,1)` → Enter (N4 tetap 1505). Save As `l01-t-wrong-function.xlsm`. Tutup Excel.
6. Jangan mengubah yang lain: tanpa judul kolom, tanpa sort/filter, tanpa sheet baru, tanpa menyisipkan baris atau kolom.
7. Di GitHub buka `FatahillahAM/Excel-Practice`, branch `claude/laughing-shannon-vnoryl`, folder `src/content/levels/01-fondasi/__fixtures__/` → **Add file → Upload files** → seret ketiga file → **Commit directly to the claude/laughing-shannon-vnoryl branch** → **Commit changes**. Beri tahu agent.

| File | Skor | Benar | Alasan |
|---|---|---|---|
| `l01-t-correct.xlsm` | 100 | 6 of 6 | — |
| `l01-t-typed-values.xlsm` | 85 | 5 of 6 | Q1 "Sel H2 berisi nilai yang diketik, bukan rumus." |
| `l01-t-wrong-function.xlsm` | 85 | 5 of 6 | Q6 "Rumus di N4 tidak memakai fungsi MAX." |
