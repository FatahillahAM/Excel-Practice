/**
 * Exam template registry (AD-4). Each version is one file under
 * `assets/templates/` plus the SHA-256 of its `xl/vbaProject.bin`; a submitted
 * workbook whose hash differs from its attempt's version is IDENTITY_ALTERED (AD-6).
 */

export interface TemplateInfo {
  /** Path from the repo root. */
  file: string;
  /** Lowercase hex SHA-256 of `xl/vbaProject.bin`; `null` until the template is in the repo. */
  vbaProjectSha256: string | null;
}

export const templates: Readonly<Record<number, TemplateInfo>> = {
  1: {
    file: "assets/templates/exam.v1.xlsm",
    vbaProjectSha256: "d8aa9aa6923880439ccd214c559fb48a731091158b0f3e3508c50d35eb11a9df",
  },
};

export const CURRENT_TEMPLATE_VERSION = 1;
