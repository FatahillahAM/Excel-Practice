import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  readAttempt: vi.fn(),
  downloadGeneratedFile: vi.fn(),
  // Every attempts write: a download must call none of them.
  writes: {
    createAttempt: vi.fn(),
    deleteOpenAttempt: vi.fn(),
    uploadGeneratedFile: vi.fn(),
    storeSubmissionFile: vi.fn(),
    changeStatus: vi.fn(),
    markReceived: vi.fn(),
    abandon: vi.fn(),
  },
  // The session client: any table or Storage access past the mocked reads shows up here.
  supabase: { from: vi.fn(), storage: { from: vi.fn() } },
}));
const SUPABASE = mocks.supabase;
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: async () => SUPABASE }));
vi.mock("@/adapters/supabase/attempts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/adapters/supabase/attempts")>()),
  readAttempt: mocks.readAttempt,
  downloadGeneratedFile: mocks.downloadGeneratedFile,
  ...mocks.writes,
}));

import { GET } from "./route";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const STORED = new Uint8Array([0x50, 0x4b, 3, 4, 9, 9, 9]);
const ATTEMPT = {
  id: ID,
  itemId: "L01-P1",
  status: "open",
  templateVersion: 1,
  startedAt: "2026-11-02T01:00:00+00:00",
  receivedAt: null,
};

const get = (attemptId = ID) =>
  GET(new Request(`https://excel-practice-omega.vercel.app/exam/${attemptId}/download`), {
    params: Promise.resolve({ attemptId }),
  });

beforeEach(() => {
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  mocks.readAttempt.mockResolvedValue({ ok: true, value: ATTEMPT });
  mocks.downloadGeneratedFile.mockResolvedValue(STORED);
});

afterEach(() => {
  vi.restoreAllMocks();
  mocks.getSessionUser.mockReset();
  mocks.readAttempt.mockReset();
  mocks.downloadGeneratedFile.mockReset();
  for (const write of Object.values(mocks.writes)) write.mockReset();
  mocks.supabase.from.mockReset();
  mocks.supabase.storage.from.mockReset();
});

const sha256 = async (res: Response) => createHash("sha256").update(new Uint8Array(await res.arrayBuffer())).digest("hex");

describe("GET /exam/<attemptId>/download", () => {
  it("serves the stored bytes as an uncached .xlsm attachment, each time the same", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/vnd.ms-excel.sheet.macroEnabled.12");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="L01-P1-0b9e0d6c3f1a.xlsm"');
    expect(res.headers.get("content-length")).toBe(String(STORED.byteLength));
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(STORED);
    expect(mocks.readAttempt).toHaveBeenCalledWith(SUPABASE, ID);
    expect(mocks.downloadGeneratedFile).toHaveBeenCalledWith(SUPABASE, ID);

    const again = await get();
    expect(new Uint8Array(await again.arrayBuffer())).toEqual(STORED);
  });

  it("Download again: two GETs give the same SHA-256 and write nothing (start time unchanged)", async () => {
    const first = await get();
    const second = await get();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const [a, b] = [await sha256(first), await sha256(second)];
    expect(a).toBe(createHash("sha256").update(STORED).digest("hex"));
    expect(b).toBe(a);
    for (const write of Object.values(mocks.writes)) expect(write).not.toHaveBeenCalled();
    expect(mocks.supabase.from).not.toHaveBeenCalled();
    expect(mocks.supabase.storage.from).not.toHaveBeenCalled();
  });

  it("answers 404 for an attempt that is not the user's or does not exist, without reading Storage", async () => {
    mocks.readAttempt.mockResolvedValue({ ok: true, value: null });
    const res = await get();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(res.headers.get("content-disposition")).toBeNull();
    expect(mocks.downloadGeneratedFile).not.toHaveBeenCalled();
  });

  it("answers 401 without a session", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const res = await get();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, code: "UNAUTHENTICATED" });
    expect(mocks.readAttempt).not.toHaveBeenCalled();
  });

  it.each([
    ["the attempt cannot be read", () => mocks.readAttempt.mockResolvedValue({ ok: false })],
    ["the file cannot be read", () => mocks.downloadGeneratedFile.mockResolvedValue(null)],
  ])("answers 500 without a file when %s", async (_, arrange) => {
    arrange();
    const res = await get();
    expect(res.status).toBe(500);
    expect(res.headers.get("content-disposition")).toBeNull();
    expect(await res.json()).toEqual({ ok: false, code: "INTERNAL_ERROR" });
  });
});
