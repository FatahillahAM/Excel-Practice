import { describe, expect, it } from "vitest";
import { MAX_SUBMISSION_BYTES, REJECTION_CODES } from "../../../../core/submission";
import { loginMessages, uploadMessages } from "../../../../messages/id";
import { UPLOAD_ACCEPT, afterUpload, pickFile, tooLarge, uploadOutcome } from "./upload";

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
    ["a 200 saying open", 200, { ok: true, data: { status: "open", duplicate: false } }],
    ["a 200 saying graded", 200, { ok: true, data: { status: "graded", duplicate: true } }],
    ["a 200 saying abandoned", 200, { ok: true, data: { status: "abandoned", duplicate: false } }],
    ["a 200 saying closed", 200, { ok: true, data: { status: "closed", duplicate: false } }],
    ["a 415 for the wrong content type", 415, { ok: false, code: "UNSUPPORTED_MEDIA_TYPE" }],
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

  it("after received: ready, tells the screen the status, no refocus", () => {
    expect(afterUpload({ kind: "received", status: "grading_failed" })).toEqual({
      state: { kind: "ready" },
      notify: { kind: "received", status: "grading_failed" },
      refocus: false,
    });
  });

  it("after a lost session: ready, tells the screen", () => {
    expect(afterUpload({ kind: "session_lost" })).toEqual({
      state: { kind: "ready" },
      notify: { kind: "session_lost" },
      refocus: false,
    });
  });

  it("after a rejection: shows its message and gives focus back", () => {
    expect(afterUpload({ kind: "rejected", message: uploadMessages.NOT_EXCEL })).toEqual({
      state: { kind: "rejected", message: uploadMessages.NOT_EXCEL },
      notify: null,
      refocus: true,
    });
  });

  it("after a failure: shows the connection message and gives focus back", () => {
    expect(afterUpload({ kind: "failed" })).toEqual({
      state: { kind: "rejected", message: uploadMessages.failed },
      notify: null,
      refocus: true,
    });
  });
});
