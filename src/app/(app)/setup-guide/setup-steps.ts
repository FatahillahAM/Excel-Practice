/**
 * Setup Steps for Excel 2021 (EXPERIENCE.md › Setup Steps, CAP-16): one source
 * for the page and its test. Titles are English chrome; bodies are casual
 * Indonesian, with the folder path and Excel/browser menus as `{ kbd }` parts
 * (rendered `<kbd lang="en">`, menus verbatim as in Excel English). The copy
 * is instructional content, not a system message, so it lives here rather
 * than in `src/messages/id.ts`.
 */

/** A run of body text, or a key / menu path shown in `Kbd`. */
export type SetupStepPart = string | { kbd: string };

export interface SetupStep {
  title: string;
  body: readonly SetupStepPart[];
}

/** The one fixed working folder: local, at the drive root (not under a OneDrive-synced Documents). */
export const SETUP_FOLDER = "C:\\ExcelPractice";

/** The Trust Center path of step 3, as in Excel 2021 English. */
export const TRUST_CENTER_PATH =
  "File > Options > Trust Center > Trust Center Settings… > Trusted Locations > Add new location…";

/** The guide's last line, verbatim (EXPERIENCE.md › Setup Steps). */
export const STILL_BLOCKED = "Still blocked? Upload appears on the exam screen after Start";

export const SETUP_STEPS: readonly SetupStep[] = [
  {
    title: "Make the working folder",
    body: [
      "Buat folder ",
      { kbd: SETUP_FOLDER },
      ". Semua file latihan selalu disimpan dan dibuka dari sini, jangan dipindah-pindah.",
    ],
  },
  {
    title: "Save downloads there",
    body: [
      "Di Chrome atau Edge, buka ",
      { kbd: "Settings > Downloads > Location > Change" },
      " lalu pilih folder ",
      { kbd: SETUP_FOLDER },
      ". Atau nyalakan ",
      { kbd: "Ask where to save each file before downloading" },
      " dan pilih folder itu setiap kali Start.",
    ],
  },
  {
    title: "Trust the folder in Excel",
    body: [
      "Di Excel, buka ",
      { kbd: TRUST_CENTER_PATH },
      ", pilih folder ",
      { kbd: SETUP_FOLDER },
      ", centang ",
      { kbd: "Subfolders of this location are also trusted" },
      ", lalu ",
      { kbd: "OK" },
      ". Cukup sekali.",
    ],
  },
  {
    title: "Open the file from the folder",
    body: [
      "Buka file ",
      { kbd: ".xlsm" },
      " dari folder ",
      { kbd: SETUP_FOLDER },
      ", bukan dari bar unduhan browser. Kalau sudah selesai mengerjakan, klik ",
      { kbd: "Finish" },
      ".",
    ],
  },
  {
    title: "Unblock if Excel still blocks it",
    body: [
      "Kalau masih muncul bar merah \u201cMicrosoft has blocked macros\u2026\u201d: tutup Excel, klik kanan file \u2192 ",
      { kbd: "Properties > General" },
      ", centang ",
      { kbd: "Unblock" },
      ", klik ",
      { kbd: "OK" },
      ", lalu buka lagi.",
    ],
  },
];
