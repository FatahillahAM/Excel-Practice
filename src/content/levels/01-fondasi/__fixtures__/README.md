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


# Fixture Excel 2021 untuk L01-T (ulang untuk 5.2)

Soal Test berubah di 5.2 (contentVersion 4): kolom H sekarang dibiarkan kosong, jawaban pindah ke I:L, target di O2, simulasi biaya di S2:V5, dan soal 6 meminta Excel Table. Ketiga file 5.1 yang sudah ada di folder ini menilai Test versi lama, jadi tes golden L01-T (Excel 2021) di `golden.test.ts` dilewati dengan alasan "not committed yet" sampai ketiganya diganti file baru di bawah (file lama dikenali dari SHA-256-nya di `l01-t.ts`).

File awal `l01-t-blank.xlsm` dibuat dengan `buildFixture("blank")` dari `l01-t.ts` (seed 7, skenario `baut-sinar-presisi`), lewat `WRITE_L01_BLANKS=<folder> npx vitest run src/content/levels/01-fondasi/__fixtures__/write-blanks.test.ts`, lalu dikirim lewat chat; file itu tidak disimpan di repo. Waktu sekitar 20 menit.

1. Simpan file ke folder mana saja. Buka di Excel 2021; bila ada **Protected View**, klik **Enable Editing**. Bar **Enable Content** boleh diabaikan. **Jangan klik Finish.**
2. Bila Excel menolak rumus ("There's a problem with this formula"), ganti setiap `,` dengan `;` lalu ketik ulang. Desimal bisa tampil dengan koma (`0,059707`); itu sama.
3. **File 1 — correct.** Di sheet `Data`:
   - **Table dulu:** klik sel **A1** → **Ctrl+T** → pastikan range `=$A$1:$G$13` dan **My table has headers** dicentang → **OK**. Kolom H harus tetap kosong; jangan ubah nama Table (`Table1`) atau gayanya.
   - Ketik rumus berikut **dengan keyboard** (jangan klik sel saat mengetik, supaya Excel tidak menulis nama kolom Table), lalu salin:
   - I2 `=E2-F2` → Enter → pilih I2:I13 → **Ctrl+D** (I2 tampil 688, I13 850).
   - J2 `=I2-$O$2` → pilih J2:J13 → **Ctrl+D** (J2 -272, J13 -110).
   - K2 `=I2/SUM($I$2:$I$13)` → pilih K2:K13 → **Ctrl+D** (K2 ≈ 0.059707, K13 ≈ 0.073766).
   - L2 `=RANK.EQ(I2,$I$2:$I$13)` → pilih L2:L13 → **Ctrl+D** (L2 11, L13 7).
   - S2 `=$R2*(1+S$1)` → pilih S2:V2 → **Ctrl+R** → pilih S2:V5 → **Ctrl+D** (S2 1168.4504, V5 1426.2626).
   - O4 `=MAX(I2:I13)` → Enter (O4 1505).
   - Pastikan **Formulas → Calculation Options = Automatic**. **File → Save As → Browse**, tipe `Excel Macro-Enabled Workbook (*.xlsm)`, nama `l01-t-correct.xlsm` → Save (timpa file lama bila ditanya).
4. **File 2 — typed-values.** Masih di file yang sama: pilih I2:I13 → **Ctrl+C** → **Home → Paste → Paste Values** (ikon 123) → Esc. Klik I2: formula bar menampilkan angka (688), bukan rumus. Save As `l01-t-typed-values.xlsm`. Tutup Excel.
5. **File 3 — wrong-function.** Buka `l01-t-correct.xlsm`. O4 ketik `=LARGE(I2:I13,1)` → Enter (O4 tetap 1505). Save As `l01-t-wrong-function.xlsm`. Tutup Excel.
6. Jangan mengubah yang lain: tanpa judul kolom tambahan, tanpa sort/filter, tanpa sheet baru, tanpa menyisipkan baris atau kolom, tanpa Total Row.
7. Di GitHub buka `FatahillahAM/Excel-Practice`, branch `claude/laughing-shannon-vnoryl`, folder `src/content/levels/01-fondasi/__fixtures__/` → **Add file → Upload files** → seret ketiga file (menggantikan file 5.1 dengan nama sama) → **Commit directly to the claude/laughing-shannon-vnoryl branch** → **Commit changes**. Beri tahu agent.

| File | Skor | Benar | Alasan |
|---|---|---|---|
| `l01-t-correct.xlsm` | 100 | 6 of 6 | — |
| `l01-t-typed-values.xlsm` | 85 | 5 of 6 | Q1 "Sel I2 berisi nilai yang diketik, bukan rumus." |
| `l01-t-wrong-function.xlsm` | 80 | 5 of 6 | Q6 "Rumus di O4 tidak memakai fungsi MAX." |


# Fixture Excel 2021 untuk L01-P2 (Excel Table)

File awal `l01-p2-blank.xlsm` dibuat dengan `buildFixture("blank")` dari `l01-p2.ts` (seed 7, skenario `baut-sinar-presisi`), dengan perintah yang sama seperti `l01-t-blank.xlsm` di atas (`write-blanks.test.ts` menulis keduanya), lalu dikirim lewat chat; file itu tidak disimpan di repo. Sampai kedua file di bawah di-commit, tes golden L01-P2 (Excel 2021) di `golden.test.ts` dilewati dengan alasan "not committed yet". Waktu sekitar 10 menit.

1. Simpan file ke folder mana saja. Buka di Excel 2021; bila ada **Protected View**, klik **Enable Editing**. Bar **Enable Content** boleh diabaikan. **Jangan klik Finish.**
2. Bila Excel menolak rumus ("There's a problem with this formula"), ganti setiap `,` dengan `;` lalu ketik ulang.
3. **File 1 — correct.** Di sheet `Data`:
   - Klik sel **A1** → **Ctrl+T** → pastikan range `=$A$1:$G$13` dan **My table has headers** dicentang → **OK**. Nama Table bawaannya `Table1` (lihat **Table Design → Table Name**); rumus di bawah memakai nama itu, jadi jangan diganti. Nama Table sendiri tidak dinilai. Jangan ubah gaya Table.
   - K2 ketik `=SUM(Table1[Unit Diproduksi])` → Enter (K2 tampil 11788).
   - K3 ketik `=SUM(Table1[Unit Cacat])` → Enter (K3 223).
   - K4 ketik `=COUNTA(Table1[Kode Batch])` → Enter (K4 12).
   - K5 ketik `=MAX(Table1[Unit Diproduksi])` → Enter (K5 1545).
   - Pastikan **Formulas → Calculation Options = Automatic**. **File → Save As → Browse**, tipe `Excel Macro-Enabled Workbook (*.xlsm)`, nama `l01-p2-correct.xlsm` → Save.
4. **File 2 — typed-values.** Masih di file yang sama: klik K2 → **Ctrl+C** → **Home → Paste → Paste Values** (ikon 123) → Esc. Klik K2: formula bar menampilkan 11788, bukan rumus. K3:K5 tetap rumus. Save As `l01-p2-typed-values.xlsm`. Tutup Excel.
5. Jangan mengubah yang lain: tanpa judul kolom tambahan, tanpa sort/filter, tanpa Total Row, tanpa sheet baru, tanpa menyisipkan baris atau kolom.
6. Di GitHub buka `FatahillahAM/Excel-Practice`, branch `claude/laughing-shannon-vnoryl`, folder `src/content/levels/01-fondasi/__fixtures__/` → **Add file → Upload files** → seret kedua file → **Commit directly to the claude/laughing-shannon-vnoryl branch** → **Commit changes**. Beri tahu agent.

| File | Skor | Benar | Alasan |
|---|---|---|---|
| `l01-p2-correct.xlsm` | 100 | 4 of 4 | — |
| `l01-p2-typed-values.xlsm` | 60 | 3 of 4 | Q1 "Sel K2 berisi nilai yang diketik, bukan rumus." |

L01-P3, L01-P4 dan L01-P5 tidak punya file Excel (rencana 5.2: fixture Excel hanya untuk Test dan satu latihan per level); varian golden-nya dibuat kode di `l01-p3.ts`, `l01-p4.ts`, `l01-p5.ts`.
