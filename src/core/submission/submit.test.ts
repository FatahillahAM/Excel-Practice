import { describe, expect, it, vi } from "vitest";
import type { AttemptStatus } from "../services/attempts";
import { RejectionCode } from "./rejection-codes";
import {
  MAX_SUBMISSION_BYTES,
  SubmissionFault,
  submit,
  type Channel,
  type SubmittedAttempt,
  type SubmissionPorts,
  type WorkbookInspection,
} from "./submit";

// Fake ports only: no zip, no hashing library, no database. `hashToken` is a
// stand-in digest (reversed text padded to 64 chars) that is enough for the rules.

const TOKEN = "A".repeat(21) + "_" + "b".repeat(21); // 43 base64url chars
const OTHER_TOKEN = "Z".repeat(43);
const ATTEMPT_ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const BYTES = new Uint8Array([0x50, 0x4b, 3, 4]);
const VBA = { modFinish: "f".repeat(64) };

const fakeHash = (token: string) => `h:${token}`.padEnd(64, "0").slice(0, 64);

interface Arrange {
  inspection?: WorkbookInspection;
  statuses?: (AttemptStatus | null)[];
  matches?: boolean | "throw";
  store?: "stored" | "failed";
  marks?: (boolean | "fail")[];
  lookupFails?: boolean;
  templateVersion?: number;
}

function ports(arrange: Arrange = {}) {
  const calls: string[] = [];
  const statuses = [...(arrange.statuses ?? ["open"])];
  const marks = [...(arrange.marks ?? [true])];
  const attempt = (status: AttemptStatus): SubmittedAttempt => ({
    id: ATTEMPT_ID,
    status,
    templateVersion: arrange.templateVersion ?? 1,
  });
  const p = {
    workbook: {
      inspect: vi.fn(async () => {
        calls.push("inspect");
        return arrange.inspection ?? ({ kind: "xlsm", token: TOKEN, vba: VBA } as const);
      }),
      fingerprintMatches: vi.fn(() => {
        calls.push("fingerprint");
        if (arrange.matches === "throw") throw new Error("Template version 9 is not in the registry");
        return arrange.matches ?? true;
      }),
      hashToken: vi.fn(fakeHash),
    },
    attempts: {
      findByTokenHash: vi.fn(async () => {
        calls.push("find");
        if (arrange.lookupFails) return { ok: false } as const;
        const status = statuses.length > 1 ? statuses.shift()! : statuses[0];
        return { ok: true, value: status === null ? null : attempt(status) } as const;
      }),
      markReceived: vi.fn(async () => {
        calls.push("mark");
        const mark = marks.length > 1 ? marks.shift()! : marks[0];
        return mark === "fail" ? ({ ok: false } as const) : ({ ok: true, value: mark } as const);
      }),
    },
    files: {
      storeSubmission: vi.fn(async () => {
        calls.push("store");
        return arrange.store ?? "stored";
      }),
    },
  } satisfies SubmissionPorts;
  return { ports: p, calls };
}

const macro = (headerToken: string | null = TOKEN): Channel => ({ kind: "macro", headerToken });
const upload: Channel = { kind: "upload" };

describe("submit: accepted", () => {
  it("stores submission-1, then moves an open attempt to received", async () => {
    const { ports: p, calls } = ports();
    const result = await submit(BYTES, macro(), p);
    expect(result).toEqual({
      ok: true,
      status: "received",
      duplicate: false,
      log: {
        attemptId: ATTEMPT_ID,
        channel: "macro",
        code: null,
        tokenSha256: fakeHash(TOKEN).slice(0, 12),
        received: true,
        duplicate: false,
      },
    });
    expect(p.attempts.findByTokenHash).toHaveBeenCalledWith(fakeHash(TOKEN));
    expect(p.files.storeSubmission).toHaveBeenCalledWith(ATTEMPT_ID, 1, BYTES);
    expect(p.workbook.fingerprintMatches).toHaveBeenCalledWith(VBA, 1);
    expect(calls).toEqual(["inspect", "find", "fingerprint", "store", "mark"]);
  });

  it("checks the fingerprint against the attempt's template_version", async () => {
    const { ports: p } = ports({ templateVersion: 7 });
    await submit(BYTES, macro(), p);
    expect(p.workbook.fingerprintMatches).toHaveBeenCalledWith(VBA, 7);
  });

  it("stores again on a re-post while open, after an earlier post's compare-and-set failed", async () => {
    const { ports: p } = ports({ marks: ["fail", true] });
    const first = new Uint8Array([1]);
    const second = new Uint8Array([2]);
    expect(await submit(first, macro(), p)).toMatchObject({ ok: false, code: "INTERNAL_ERROR" });
    expect(await submit(second, macro(), p)).toMatchObject({ ok: true, status: "received", duplicate: false });
    expect(p.files.storeSubmission.mock.calls.map((call) => (call as unknown[])[2])).toEqual([first, second]);
  });

  it.each(["received", "grading_failed"] as const)("accepts a %s attempt as a duplicate without storing", async (status) => {
    const { ports: p } = ports({ statuses: [status] });
    const result = await submit(BYTES, macro(), p);
    expect(result).toMatchObject({ ok: true, status, duplicate: true, log: { duplicate: true, received: false, code: null } });
    expect(p.files.storeSubmission).not.toHaveBeenCalled();
    expect(p.attempts.markReceived).not.toHaveBeenCalled();
  });

  it("does not check a header on the upload channel", async () => {
    const { ports: p } = ports();
    const result = await submit(BYTES, upload, p);
    expect(result).toMatchObject({ ok: true, status: "received", log: { channel: "upload", received: true } });
    expect(p.workbook.hashToken).toHaveBeenCalledTimes(1);
  });
});

describe("submit: refusals per AD-6 step", () => {
  const cases: [string, Arrange, Channel, string][] = [
    ["not a workbook", { inspection: { kind: "not_excel" } }, macro(), RejectionCode.NOT_EXCEL],
    ["a spreadsheet that is not .xlsm", { inspection: { kind: "not_xlsm" } }, macro(), RejectionCode.IDENTITY_ALTERED],
    ["no token", { inspection: { kind: "xlsm", token: null, vba: VBA } }, macro(null), RejectionCode.IDENTITY_ALTERED],
    ["a malformed token", { inspection: { kind: "xlsm", token: "TEMPLATE", vba: VBA } }, macro("TEMPLATE"), RejectionCode.IDENTITY_ALTERED],
    ["a missing header", {}, macro(null), RejectionCode.IDENTITY_ALTERED],
    ["a header with another token", {}, macro(OTHER_TOKEN), RejectionCode.IDENTITY_ALTERED],
    ["an unknown token", { statuses: [null] }, macro(), RejectionCode.NOT_THIS_ATTEMPT],
    ["a fingerprint that does not match", { matches: false }, macro(), RejectionCode.IDENTITY_ALTERED],
    ["a graded attempt", { statuses: ["graded"] }, macro(), RejectionCode.ALREADY_GRADED],
    ["an abandoned attempt", { statuses: ["abandoned"] }, macro(), RejectionCode.ATTEMPT_CLOSED],
    ["a closed attempt", { statuses: ["closed"] }, upload, RejectionCode.ATTEMPT_CLOSED],
  ];

  it.each(cases)("refuses %s", async (_, arrange, channel, code) => {
    const { ports: p } = ports(arrange);
    const result = await submit(BYTES, channel, p);
    expect(result).toMatchObject({ ok: false, code, log: { code, received: false, duplicate: false } });
    expect(p.files.storeSubmission).not.toHaveBeenCalled();
    expect(p.attempts.markReceived).not.toHaveBeenCalled();
  });

  it("refuses an empty body as NOT_EXCEL without inspecting it", async () => {
    const { ports: p } = ports();
    expect(await submit(new Uint8Array(0), macro(), p)).toMatchObject({ ok: false, code: RejectionCode.NOT_EXCEL });
    expect(p.workbook.inspect).not.toHaveBeenCalled();
  });

  it("refuses a body over MAX_SUBMISSION_BYTES with FILE_TOO_LARGE before reading it", async () => {
    const { ports: p } = ports();
    const result = await submit(new Uint8Array(MAX_SUBMISSION_BYTES + 1), macro(), p);
    expect(result).toMatchObject({ ok: false, code: SubmissionFault.FILE_TOO_LARGE });
    expect(p.workbook.inspect).not.toHaveBeenCalled();
    expect(await submit(new Uint8Array(MAX_SUBMISSION_BYTES), macro(), ports({ inspection: { kind: "not_excel" } }).ports))
      .toMatchObject({ code: RejectionCode.NOT_EXCEL });
  });

  it("logs the token hash from step 2 on, and the attempt id from step 3 on", async () => {
    const notExcel = await submit(BYTES, macro(), ports({ inspection: { kind: "not_excel" } }).ports);
    expect(notExcel.log).toMatchObject({ tokenSha256: null, attemptId: null });
    const header = await submit(BYTES, macro(OTHER_TOKEN), ports().ports);
    expect(header.log).toMatchObject({ tokenSha256: fakeHash(TOKEN).slice(0, 12), attemptId: null });
    const fingerprint = await submit(BYTES, macro(), ports({ matches: false }).ports);
    expect(fingerprint.log).toMatchObject({ attemptId: ATTEMPT_ID });
    for (const result of [notExcel, header, fingerprint]) {
      expect(JSON.stringify(result.log)).not.toContain(TOKEN);
      expect(JSON.stringify(result.log)).not.toContain(fakeHash(TOKEN));
    }
  });
});

describe("submit: two reasons give the earlier step's code", () => {
  it.each<[string, Arrange, Channel, string]>([
    ["not Excel and a wrong header", { inspection: { kind: "not_excel" } }, macro(OTHER_TOKEN), RejectionCode.NOT_EXCEL],
    ["not .xlsm and an unknown token", { inspection: { kind: "not_xlsm" }, statuses: [null] }, macro(), RejectionCode.IDENTITY_ALTERED],
    ["a wrong header and an unknown token", { statuses: [null] }, macro(OTHER_TOKEN), RejectionCode.IDENTITY_ALTERED],
    ["an unknown token and a bad fingerprint", { statuses: [null], matches: false }, macro(), RejectionCode.NOT_THIS_ATTEMPT],
    ["a bad fingerprint and a graded attempt", { statuses: ["graded"], matches: false }, macro(), RejectionCode.IDENTITY_ALTERED],
    ["a bad fingerprint and a duplicate", { statuses: ["received"], matches: false }, macro(), RejectionCode.IDENTITY_ALTERED],
  ])("%s", async (_, arrange, channel, code) => {
    const { ports: p } = ports(arrange);
    expect(await submit(BYTES, channel, p)).toMatchObject({ ok: false, code });
  });

  it("never reads the attempt before steps 1–2 pass", async () => {
    const { ports: p } = ports({ inspection: { kind: "not_xlsm" } });
    await submit(BYTES, macro(), p);
    expect(p.attempts.findByTokenHash).not.toHaveBeenCalled();
  });
});

describe("submit: lost compare-and-set", () => {
  it("re-reads the attempt and decides step 5 again", async () => {
    const { ports: p, calls } = ports({ statuses: ["open", "abandoned"], marks: [false] });
    const result = await submit(BYTES, macro(), p);
    expect(result).toMatchObject({ ok: false, code: RejectionCode.ATTEMPT_CLOSED, log: { attemptId: ATTEMPT_ID } });
    expect(calls).toEqual(["inspect", "find", "fingerprint", "store", "mark", "find"]);
  });

  it("answers a duplicate when another post moved it to received", async () => {
    const { ports: p } = ports({ statuses: ["open", "received"], marks: [false] });
    expect(await submit(BYTES, macro(), p)).toMatchObject({ ok: true, status: "received", duplicate: true });
  });

  it("stores again and retries the compare-and-set when it is still open", async () => {
    const { ports: p } = ports({ statuses: ["open", "open"], marks: [false, true] });
    const result = await submit(BYTES, macro(), p);
    expect(result).toMatchObject({ ok: true, status: "received", log: { received: true } });
    expect(p.attempts.markReceived).toHaveBeenCalledTimes(2);
  });

  it("gives up with INTERNAL_ERROR when the status never settles", async () => {
    const { ports: p } = ports({ statuses: ["open"], marks: [false] });
    expect(await submit(BYTES, macro(), p)).toMatchObject({ ok: false, code: "INTERNAL_ERROR", failure: "status_unsettled" });
  });
});

describe("submit: server faults", () => {
  it.each<[string, Arrange, string]>([
    ["the lookup fails", { lookupFails: true }, "lookup_failed"],
    ["the template version is not in the registry", { matches: "throw" }, "template_version_unknown"],
    ["the file cannot be stored", { store: "failed" }, "store_failed"],
    ["the status change fails", { marks: ["fail"] }, "mark_received_failed"],
  ])("answers INTERNAL_ERROR when %s", async (_, arrange, failure) => {
    const { ports: p } = ports(arrange);
    const result = await submit(BYTES, macro(), p);
    expect(result).toMatchObject({ ok: false, code: SubmissionFault.INTERNAL_ERROR, failure, log: { received: false } });
  });

  it("leaves the attempt open when storing fails", async () => {
    const { ports: p } = ports({ store: "failed" });
    await submit(BYTES, macro(), p);
    expect(p.attempts.markReceived).not.toHaveBeenCalled();
  });
});
