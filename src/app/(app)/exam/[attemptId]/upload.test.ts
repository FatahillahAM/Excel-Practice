import { describe, expect, it } from "vitest";
import { MAX_SUBMISSION_BYTES, REJECTION_CODES } from "../../../../core/submission";
import { loginMessages, uploadMessages } from "../../../../messages/id";
import { UPLOAD_ACCEPT, pickFile, tooLarge, uploadOutcome } from "./upload";

describe("Upload Dropzone logic", () => {
  it("sends only the first file of a pick or a drop", () => {
    expect(pickFile(["a.xlsm", "b.xlsm"])).toBe("a.xlsm");
    expect(pickFile(["a.xlsm"])).toBe("a.xlsm");
    expect(pickFile([])).toBeNull();
    expect(pickFile(null)).toBeNull();
    expect(pickFile(undefined)).toBeNull();
  });

  it("refuses more than 4 MiB before sending", () => {
    expect(tooLarge(MAX_SUBMISSION_BYTES)).toBe(false);
    expect(tooLarge(MAX_SUBMISSION_BYTES + 1)).toBe(true);
    expect(tooLarge(0)).toBe(false);
  });

  it("offers .xlsm and .xlsx in the picker", () => {
    expect(UPLOAD_ACCEPT).toBe(".xlsm,.xlsx");
  });

  it("moves to the attempt's status on 200, also for a duplicate", () => {
    expect(uploadOutcome(200, { ok: true, data: { status: "received", duplicate: false } })).toEqual({
      kind: "received",
      status: "received",
    });
    expect(uploadOutcome(200, { ok: true, data: { status: "grading_failed", duplicate: true } })).toEqual({
      kind: "received",
      status: "grading_failed",
    });
  });

  it.each(REJECTION_CODES)("shows the message for %s", (code) => {
    expect(uploadOutcome(400, { ok: false, code })).toEqual({ kind: "rejected", message: uploadMessages[code] });
  });

  it("shows the size message for 413", () => {
    expect(uploadOutcome(413, { ok: false, code: "FILE_TOO_LARGE" })).toEqual({
      kind: "rejected",
      message: uploadMessages.FILE_TOO_LARGE,
    });
  });

  it("loses the session on 401", () => {
    expect(uploadOutcome(401, { ok: false, code: "UNAUTHENTICATED" })).toEqual({ kind: "session_lost" });
    expect(uploadOutcome(401, null)).toEqual({ kind: "session_lost" });
  });

  it.each([
    ["a server fault", 500, { ok: false, code: "INTERNAL_ERROR" }],
    ["an unknown code", 400, { ok: false, code: "SOMETHING_NEW" }],
    ["a body that is not JSON", 502, null],
    ["a 200 without a status", 200, { ok: true, data: {} }],
    ["a 200 with an unknown status", 200, { ok: true, data: { status: "weird" } }],
    ["a string body", 200, "ok"],
  ])("fails on %s", (_, status, body) => {
    expect(uploadOutcome(status, body)).toEqual({ kind: "failed" });
  });

  it("has the five rejection messages verbatim from EXPERIENCE.md, and the network row for failures", () => {
    expect(uploadMessages).toMatchObject({
      NOT_THIS_ATTEMPT:
        "File ini bukan dari percobaan yang sedang berjalan. Upload file yang kamu unduh waktu klik Start, ya.",
      ALREADY_GRADED: "File ini sudah dinilai. Hasilnya ada di History, ya.",
      IDENTITY_ALTERED:
        "Identitas file ini rusak atau berubah. Pakai file .xlsm asli dari Start dan jangan Save As ke format lain, ya.",
      ATTEMPT_CLOSED: "Percobaan ini sudah ditutup, jadi file-nya nggak bisa dinilai. Mulai percobaan baru, ya.",
      NOT_EXCEL: "Ini bukan file Excel. Pilih file .xlsm dari percobaan ini, ya.",
      FILE_TOO_LARGE: "File ini terlalu besar (maksimal 4 MB). Pakai file .xlsm asli dari Start, ya.",
    });
    expect(uploadMessages.failed).toBe(loginMessages.network);
  });
});
