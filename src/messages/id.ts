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
