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

/** Attempt Card's Abandon dialog (Dashboard; illustrative, like `startMessages`). */
export const attemptMessages = {
  /** The dialog's body: what Abandon does. */
  abandonBody: "Percobaan ini dibatalkan dan nggak dinilai. File-nya nggak bisa dikirim lagi, ya.",
  /** Abandon did not go through, for any reason (illustrative). */
  abandonFailed: "Percobaannya belum bisa dibatalkan. Coba lagi, ya.",
} as const;

/** Exam in progress (EXPERIENCE.md › Component Patterns › Exam Status Line, Message set). */
export const examMessages = {
  /** Exam Status Line, line 2 while the attempt is open. */
  finishHint: "Klik Finish di file kalau sudah selesai, ya.",
  /** "Grading slow" row: after 15 s in `received` (AD-11). */
  gradingSlow: "Penilaian agak lama, tunggu sebentar ya.",
} as const;

/**
 * Upload Dropzone's inline message slot (EXPERIENCE.md › Message set): one per
 * AD-6 rejection code (verbatim), the size limit and a failed request.
 */
export const uploadMessages = {
  /** "Not an Excel file" row. */
  NOT_EXCEL: "Ini bukan file Excel. Pilih file .xlsm dari percobaan ini, ya.",
  /** "Rejected — identity altered or damaged" row. */
  IDENTITY_ALTERED:
    "Identitas file ini rusak atau berubah. Pakai file .xlsm asli dari Start dan jangan Save As ke format lain, ya.",
  /** "Rejected — not from this attempt" row (decided). */
  NOT_THIS_ATTEMPT:
    "File ini bukan dari percobaan yang sedang berjalan. Upload file yang kamu unduh waktu klik Start, ya.",
  /** "Rejected — already graded" row. */
  ALREADY_GRADED: "File ini sudah dinilai. Hasilnya ada di History, ya.",
  /** "Rejected — attempt already closed" row. */
  ATTEMPT_CLOSED: "Percobaan ini sudah ditutup, jadi file-nya nggak bisa dinilai. Mulai percobaan baru, ya.",
  /** Larger than 4 MiB, refused before sending or by the server's 413 (illustrative, like `startMessages`). */
  FILE_TOO_LARGE: "File ini terlalu besar (maksimal 4 MB). Pakai file .xlsm asli dari Start, ya.",
  /** The request failed or the server faulted (the Login "network" row). */
  failed: "Koneksi lagi bermasalah. Coba lagi sebentar, ya.",
} as const;

export type UploadMessage = keyof typeof uploadMessages;
