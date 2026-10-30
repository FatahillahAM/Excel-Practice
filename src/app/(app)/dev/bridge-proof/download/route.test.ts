import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  insert: vi.fn(),
  from: vi.fn(),
  generateExamWorkbook: vi.fn(),
  realGenerate: null as null | ((...args: unknown[]) => unknown),
}));
vi.mock("../../../../../adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("../../../../../adapters/supabase/server", () => ({
  createClient: async () => ({ from: mocks.from }),
}));
vi.mock("../../../../../adapters/workbook/generate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../adapters/workbook/generate")>();
  mocks.realGenerate = actual.generateExamWorkbook as (...args: unknown[]) => unknown;
  return { ...actual, generateExamWorkbook: mocks.generateExamWorkbook };
});

import { readWorkbook } from "../../../../../adapters/workbook/read";
import { CURRENT_TEMPLATE_VERSION, matchesTemplate } from "../../../../../adapters/workbook/templates";
import { tokenSha256Hex } from "../../../../api/submissions/macro/inspect";
import { GET } from "./route";

const URL_ = "https://excel-practice-omega.vercel.app/dev/bridge-proof/download";

beforeEach(() => {
  mocks.generateExamWorkbook.mockImplementation((...args: unknown[]) => mocks.realGenerate!(...args));
  mocks.from.mockImplementation(() => ({ insert: mocks.insert }));
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  mocks.getSessionUser.mockReset();
  mocks.insert.mockReset();
  mocks.from.mockReset();
  mocks.generateExamWorkbook.mockReset();
});

describe("GET /dev/bridge-proof/download", () => {
  it("answers 401 UNAUTHENTICATED without a session and writes nothing", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    const res = await GET(new Request(URL_));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, code: "UNAUTHENTICATED" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("answers 500 without a file when the proof row cannot be created", async () => {
    mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
    mocks.insert.mockResolvedValue({ error: { code: "42501", message: "denied" } });
    const res = await GET(new Request(URL_));
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(res.headers.get("content-disposition")).toBeNull();
    expect(await res.json()).toEqual({ ok: false, code: "INTERNAL_ERROR" });
  });

  it("answers 500 without a file or a row when generation fails, and logs only the 12-hex hash", async () => {
    mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.generateExamWorkbook.mockRejectedValue(new Error("ENOENT: no such file"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(new Request(URL_));
    expect(res.status).toBe(500);
    expect(res.headers.get("content-disposition")).toBeNull();
    expect(await res.json()).toEqual({ ok: false, code: "INTERNAL_ERROR" });
    expect(mocks.insert).not.toHaveBeenCalled();

    const token = (mocks.generateExamWorkbook.mock.calls[0][0] as { token: string }).token;
    const lines = error.mock.calls.map((args) => args.map(String).join(" "));
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(token);
    expect(lines[0]).not.toContain(tokenSha256Hex(token));
    const logged = JSON.parse(lines[0]) as { tokenSha256: string };
    expect(logged.tokenSha256).toMatch(/^[0-9a-f]{12}$/);
    expect(logged.tokenSha256).toBe(tokenSha256Hex(token).slice(0, 12));
  });

  it("records the token's hash, then serves the patched .xlsm as an uncached attachment", async () => {
    mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
    mocks.insert.mockResolvedValue({ error: null });
    const res = await GET(new Request(URL_));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/vnd.ms-excel.sheet.macroEnabled.12");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).toMatch(/^attachment; filename="bridge-proof-[0-9a-f]{12}\.xlsm"$/);

    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(res.headers.get("content-length")).toBe(String(bytes.byteLength));
    const reading = await readWorkbook(bytes);
    const token = reading.properties.WHE_AttemptToken;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(reading.properties.WHE_ServerUrl).toBe("https://excel-practice-omega.vercel.app");
    expect(reading.properties.WHE_TemplateVersion).toBe(String(CURRENT_TEMPLATE_VERSION));
    expect(matchesTemplate(reading.vbaModuleHashes, CURRENT_TEMPLATE_VERSION)).toBe(true);
    expect(reading.sheets.Instructions.B6.value).toMatch(/Data!I2.*SUMIFS/);
    expect(reading.sheets.Data.A1.value).toBe("Kode Batch");
    expect(reading.sheets.Data.I2).toBeUndefined();

    const hash = tokenSha256Hex(token);
    expect(mocks.from).toHaveBeenCalledWith("bridge_proofs");
    expect(mocks.insert).toHaveBeenCalledWith({ token_sha256: hash, template_version: CURRENT_TEMPLATE_VERSION });
    expect(disposition).toContain(hash.slice(0, 12));
  });

  it("gives every download a new token", async () => {
    mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
    mocks.insert.mockResolvedValue({ error: null });
    await GET(new Request(URL_));
    await GET(new Request(URL_));
    const [first, second] = mocks.insert.mock.calls.map(([row]) => (row as { token_sha256: string }).token_sha256);
    expect(first).not.toBe(second);
  });

  it("uses the request's origin as WHE_ServerUrl", async () => {
    mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
    mocks.insert.mockResolvedValue({ error: null });
    const res = await GET(new Request("http://localhost:3000/dev/bridge-proof/download"));
    const reading = await readWorkbook(new Uint8Array(await res.arrayBuffer()));
    expect(reading.properties.WHE_ServerUrl).toBe("http://localhost:3000");
  });

  it("never logs the token", async () => {
    mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
    mocks.insert.mockResolvedValue({ error: null });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await GET(new Request(URL_));
    const token = (await readWorkbook(new Uint8Array(await res.arrayBuffer()))).properties.WHE_AttemptToken;
    const lines = log.mock.calls.map((args) => args.map(String).join(" "));
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(token);
    expect(JSON.parse(lines[0])).toEqual({ event: "bridge_proof.downloaded", tokenSha256: tokenSha256Hex(token).slice(0, 12) });
  });
});
