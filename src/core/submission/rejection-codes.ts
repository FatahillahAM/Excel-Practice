/**
 * Why a submitted workbook is refused (AD-6). One contract for the macro path,
 * the upload path, the web UI (EXPERIENCE.md message set) and the VBA in the
 * exam template, which maps each code to a message box. Adding a code bumps
 * `WHE_TemplateVersion`.
 */
export const RejectionCode = {
  /** Not an OOXML package, or a workbook the reader cannot read. */
  NOT_EXCEL: "NOT_EXCEL",
  /** Not a macro-enabled `.xlsm`, token missing, malformed or ≠ `X-Attempt-Token`, or the VBA fingerprint does not match. */
  IDENTITY_ALTERED: "IDENTITY_ALTERED",
  /** No attempt has the file's token. */
  NOT_THIS_ATTEMPT: "NOT_THIS_ATTEMPT",
  /** The attempt is already graded. */
  ALREADY_GRADED: "ALREADY_GRADED",
  /** The attempt was abandoned or closed. */
  ATTEMPT_CLOSED: "ATTEMPT_CLOSED",
} as const;

export type RejectionCode = (typeof RejectionCode)[keyof typeof RejectionCode];

export const REJECTION_CODES: readonly RejectionCode[] = Object.values(RejectionCode);
