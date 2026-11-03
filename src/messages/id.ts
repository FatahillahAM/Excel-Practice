/**
 * Indonesian system messages (Consistency Conventions › Copy). Text is taken
 * verbatim from EXPERIENCE.md › Message set; the UI maps codes to these and
 * never shows server text.
 */

/** Login Card inline error slot (EXPERIENCE.md › Message set, Login rows). */
export const loginMessages = {
  notAllowed: "Akun ini nggak terdaftar. Masuk pakai akun Google kamu sendiri, ya.",
  popupBlocked: "Pop-up login diblokir browser. Izinkan pop-up untuk situs ini, lalu coba lagi, ya.",
  network: "Koneksi lagi bermasalah. Coba lagi sebentar, ya.",
} as const;

export type LoginError = keyof typeof loginMessages;

/** Signed-in surfaces (EXPERIENCE.md › Message set, State Patterns › Settings). */
export const shellMessages = {
  /** "First-load failure" row, verbatim. */
  firstLoadFailed: "Datanya belum kemuat. Coba lagi, ya.",
  /** Settings › Saved / error (illustrative). */
  preferenceSaveFailed: "Pengaturan belum tersimpan. Coba lagi, ya.",
} as const;

/** Start's inline error slot (Level 1 · Practice 1 on /levels). */
export const startMessages = {
  /** No `profiles` row and the browser sent no zone the database accepts (illustrative, like `preferenceSaveFailed`). */
  profileMissing: "Zona waktu kamu belum tercatat. Muat ulang halaman ini, lalu coba lagi, ya.",
  /** Generating, storing or recording the attempt failed (the Login "network" row). */
  startFailed: "Koneksi lagi bermasalah. Coba lagi sebentar, ya.",
} as const;

export type StartError = keyof typeof startMessages;

/** Exam in progress (EXPERIENCE.md › Component Patterns › Exam Status Line, Message set). */
export const examMessages = {
  /** Exam Status Line, line 2 while the attempt is open. */
  finishHint: "Klik Finish di file kalau sudah selesai, ya.",
  /** "Grading slow" row: after 15 s in `received` (AD-11). */
  gradingSlow: "Penilaian agak lama, tunggu sebentar ya.",
} as const;
