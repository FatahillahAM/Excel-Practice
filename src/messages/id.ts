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
  /** "Grading failed" row: the attempt is `grading_failed` (alert, with "Try again"). */
  gradingFailed: "Penilaian gagal. Coba lagi, ya — file kamu aman.",
  /** Try again did not go through (the Login "network" row). */
  retryFailed: "Koneksi lagi bermasalah. Coba lagi sebentar, ya.",
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
  /** "Too large" row (Upload + macro): larger than 4 MiB, refused before sending or by the server's 413. */
  FILE_TOO_LARGE: "File ini terlalu besar (maksimal 4 MB). Pakai file .xlsm asli dari Start, ya.",
  /** The request failed or the server faulted (the Login "network" row). */
  failed: "Koneksi lagi bermasalah. Coba lagi sebentar, ya.",
} as const;

/**
 * The Finish macro's message boxes (`assets/templates/vba/modFinish.bas`, CAP-3,
 * CAP-18): one per answer of the macro route, the local size check and the
 * failures before or during the send. Rejection rows reuse `uploadMessages`
 * verbatim (the Message set rows are "Upload + macro"), except `NOT_EXCEL`,
 * which has its own "Not an Excel file" (Macro) row; `sent`, `sendFailed`,
 * `tlsFailed`, `tempFailed` and `saveFailed` are the "Macro …" rows. The `.bas` holds each string
 * as a literal (the em dash as `ChrW$(8212)`, the file is ASCII), which
 * `modfinish-source.test.ts` checks, so this object is the one source.
 */
export const macroMessages = {
  /** "Macro sent" row: HTTP 200 with `"ok":true`, also a duplicate. */
  sent: "File terkirim! Hasilnya muncul di web, ya.",
  NOT_THIS_ATTEMPT: uploadMessages.NOT_THIS_ATTEMPT,
  ALREADY_GRADED: uploadMessages.ALREADY_GRADED,
  IDENTITY_ALTERED: uploadMessages.IDENTITY_ALTERED,
  ATTEMPT_CLOSED: uploadMessages.ATTEMPT_CLOSED,
  /** "Not an Excel file" (Macro) row: unlike the Upload row it says to upload this same file. */
  NOT_EXCEL: "Server nggak bisa membaca file ini sebagai file Excel. Upload file ini lewat web, ya.",
  /** "Too large" row: larger than `MAX_SUBMISSION_BYTES` locally, or HTTP 413; the same text as upload. */
  FILE_TOO_LARGE: uploadMessages.FILE_TOO_LARGE,
  /** "Macro send failed" row: network, timeout, 500, any other HTTP status or an unknown code. */
  sendFailed: "File belum terkirim. Filenya sudah tersimpan — upload lewat web, ya.",
  /** "Macro TLS failed" row: WinHTTP certificate or secure-channel error, usually a wrong laptop clock. */
  tlsFailed:
    "Koneksi aman ke server gagal. Biasanya karena tanggal dan jam laptop salah, bukan internet kamu. Cek jamnya lalu klik Finish lagi, atau upload lewat web, ya.",
  /** "Macro TEMP copy failed" row: `TEMP`/`TMP` empty, or the copy could not be written or read there. */
  tempFailed: "Salinan file nggak bisa dibuat di folder TEMP Windows. Filenya sudah tersimpan — upload lewat web, ya.",
  /** "Macro save failed" row: `ThisWorkbook.Save` failed or the file is read-only, so nothing is sent. Save As, because Ctrl+S on a read-only file opens Save As with a possibly wrong type. */
  saveFailed:
    "File belum bisa disimpan, jadi belum dikirim. Pakai File > Save As, simpan sebagai .xlsm di folder kerja kamu, lalu klik Finish lagi, ya.",
  /** Properties missing or still `TEMPLATE` (the raw template): wording kept, `assets/templates/README.md` relies on it. */
  incomplete: "File ini tidak berisi data ujian yang lengkap.",
  incompleteNext: "Unduh ulang file ujian dari aplikasi.",
  /** Line under a rejection: the code the server answered, so it can be reported (EXPERIENCE forbids codes alone). */
  codeLabel: "Kode: ",
  /** Line under any other failure: the HTTP status or the error text and number. */
  detailLabel: "Detail: ",
} as const;

export type MacroMessage = keyof typeof macroMessages;
