import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  getSessionUser: vi.fn(),
  createServiceClient: vi.fn(),
  findAttemptByTokenHash: vi.fn(),
  markReceived: vi.fn(),
  storeSubmissionFile: vi.fn(),
  downloadSubmissionFile: vi.fn(),
  loadForGrading: vi.fn(),
  changeStatus: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/adapters/supabase/attempts", () => ({
  findAttemptByTokenHash: mocks.findAttemptByTokenHash,
  markReceived: mocks.markReceived,
  storeSubmissionFile: mocks.storeSubmissionFile,
  downloadSubmissionFile: mocks.downloadSubmissionFile,
  loadForGrading: mocks.loadForGrading,
  changeStatus: mocks.changeStatus,
}));

import { CURRENT_TEMPLATE_VERSION } from "@/adapters/workbook/templates";
import { tokenSha256Hex } from "@/adapters/workbook/token";
import { resultSchema, type Result } from "@/core/grading";
import {
  FIXTURE_TOKEN,
  VARIANTS,
  buildFixture,
  expectedResult,
  fixtureSnapshot,
  type Variant,
} from "@/content/levels/01-fondasi/__fixtures__/l01-p1";
import { POST as macroPOST } from "./macro/route";
import { POST as uploadPOST } from "./upload/route";

// Parity (AD-11): the same file's bytes, posted through the macro route (its
// header token) and the upload route (the session user owns the attempt),
// are graded by the one scheduleGrading path and write identical Results,
// equal to the golden expectation. Supabase is an in-memory fake: the stored
// submission is the downloaded one, and changeStatus captures the Result.

const USER_ID = "user-1";
const SERVICE = { service: true };
const ATTEMPT_ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const snapshot = fixtureSnapshot();

/** The attempt's state in the fake database and storage. */
let stored: Uint8Array | null;
let status: "open" | "received" | "graded";
let written: { event: string; result: Result | undefined }[];

const files = new Map<Variant, Uint8Array>();
beforeAll(async () => {
  for (const variant of VARIANTS) files.set(variant, await buildFixture(variant));
});

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getSessionUser.mockResolvedValue({ id: USER_ID, email: null });
  mocks.createServiceClient.mockReturnValue(SERVICE);
  mocks.findAttemptByTokenHash.mockImplementation(async (_client, hash: string) => ({
    ok: true,
    value:
      hash === tokenSha256Hex(FIXTURE_TOKEN)
        ? { id: ATTEMPT_ID, userId: USER_ID, status, templateVersion: CURRENT_TEMPLATE_VERSION }
        : null,
  }));
  mocks.storeSubmissionFile.mockImplementation(async (_client, _id, n: number, bytes: Uint8Array) => {
    if (n === 1) stored = Uint8Array.from(bytes);
    return "stored";
  });
  mocks.markReceived.mockImplementation(async () => {
    status = "received";
    return { ok: true, value: true };
  });
  mocks.loadForGrading.mockImplementation(async (_client, id: string) => ({
    ok: true,
    value: id === ATTEMPT_ID ? { status, snapshot } : null,
  }));
  mocks.downloadSubmissionFile.mockImplementation(async (_client, id: string, n: number) => ({
    ok: true,
    value: id === ATTEMPT_ID && n === 1 ? stored : null,
  }));
  mocks.changeStatus.mockImplementation(async (_client, _id, _from, event: string, _log, options: { result?: Result } = {}) => {
    written.push({ event, result: options.result });
    status = "graded";
    return { outcome: "changed", status: "graded" };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const mock of Object.values(mocks)) mock.mockReset();
});

/** Posts `bytes` through one route on a fresh open attempt, runs the after() task, and returns the written Result. */
async function gradeThrough(channel: "macro" | "upload", bytes: Uint8Array): Promise<Result> {
  stored = null;
  status = "open";
  written = [];
  mocks.after.mockReset();
  const headers: Record<string, string> = { "content-type": "application/octet-stream" };
  if (channel === "macro") headers["x-attempt-token"] = FIXTURE_TOKEN;
  const request = new Request(`https://example.test/api/submissions/${channel}`, {
    method: "POST",
    headers,
    body: Buffer.from(bytes),
  });
  const response = await (channel === "macro" ? macroPOST : uploadPOST)(request);
  expect(await response.json()).toEqual({ ok: true, data: { status: "received", duplicate: false } });
  expect(stored).toEqual(bytes);

  expect(mocks.after).toHaveBeenCalledTimes(1);
  for (const [task] of mocks.after.mock.calls as [() => Promise<unknown>][]) await task();
  expect(written).toHaveLength(1);
  expect(written[0].event).toBe("grade_ok");
  return resultSchema.parse(written[0].result);
}

describe("macro and upload grade the same file to the same Result", () => {
  it.each(VARIANTS)("%s", async (variant) => {
    const bytes = files.get(variant)!;
    const macro = await gradeThrough("macro", bytes);
    const upload = await gradeThrough("upload", bytes);
    expect(upload).toEqual(macro);
    expect(macro).toEqual(expectedResult(variant, snapshot));
  });
});
