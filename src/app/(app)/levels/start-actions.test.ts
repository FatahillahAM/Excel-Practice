import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
  getSessionUser: vi.fn(),
  readTimeZone: vi.fn(),
  ensureProfile: vi.fn(),
  createAttempt: vi.fn(),
  deleteOpenAttempt: vi.fn(),
  findOpenAttemptId: vi.fn(),
  uploadGeneratedFile: vi.fn(),
  generateExamWorkbook: vi.fn(),
  writeSnapshot: vi.fn(),
  createServiceClient: vi.fn(),
  randomInt: vi.fn(),
  realRandomInt: null as null | ((max: number) => number),
  realGenerate: null as null | ((...args: unknown[]) => unknown),
}));
const SUPABASE = { session: true };
const SERVICE = { service: true };

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: async () => SUPABASE }));
vi.mock("@/adapters/supabase/profiles", () => ({
  readTimeZone: mocks.readTimeZone,
  ensureProfile: mocks.ensureProfile,
}));
vi.mock("@/adapters/supabase/attempts", () => ({
  createAttempt: mocks.createAttempt,
  deleteOpenAttempt: mocks.deleteOpenAttempt,
  findOpenAttemptId: mocks.findOpenAttemptId,
  uploadGeneratedFile: mocks.uploadGeneratedFile,
  writeSnapshot: mocks.writeSnapshot,
}));
vi.mock("@/adapters/supabase/service", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  mocks.realRandomInt = actual.randomInt as (max: number) => number;
  return { ...actual, default: actual, randomInt: mocks.randomInt };
});
vi.mock("@/adapters/workbook/generate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/adapters/workbook/generate")>();
  mocks.realGenerate = actual.generateExamWorkbook as (...args: unknown[]) => unknown;
  return { ...actual, generateExamWorkbook: mocks.generateExamWorkbook };
});

import { readWorkbook } from "@/adapters/workbook/read";
import { CURRENT_TEMPLATE_VERSION, matchesTemplate } from "@/adapters/workbook/templates";
import { tokenSha256Hex } from "@/adapters/workbook/token";
import { findItem } from "@/content/levels";
import {
  examSnapshotSchema,
  type ExamSnapshot,
  type GeneratedExam,
  type Scenario,
} from "@/core/content/level-module";
import { startMessages } from "@/messages/id";
import { startAttempt, type StartState } from "./start-actions";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const OTHER_ID = "11111111-2222-4333-8444-555555555555";
const IDLE: StartState = { status: "idle" };

function form(fields: Record<string, string> = { itemId: "L01-P1", timeZone: "Asia/Jakarta" }): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** Runs the action; a `redirect()` comes back as `{ redirected: url }`. */
async function start(data = form()): Promise<StartState | { redirected: string }> {
  try {
    return await startAttempt(IDLE, data);
  } catch (error) {
    const url = (error as { url?: string }).url;
    if (url) return { redirected: url };
    throw error;
  }
}

type ConsoleSpy = { mock: { calls: unknown[][] } };
let logs: ConsoleSpy;
let errors: ConsoleSpy;

beforeEach(() => {
  mocks.headers.mockResolvedValue(new Headers({ origin: "https://excel-practice-omega.vercel.app", host: "excel-practice-omega.vercel.app" }));
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  mocks.readTimeZone.mockResolvedValue({ ok: true, timeZone: "Asia/Jakarta" });
  mocks.ensureProfile.mockResolvedValue("created");
  mocks.createAttempt.mockResolvedValue({ ok: true, id: ID });
  mocks.deleteOpenAttempt.mockResolvedValue(true);
  mocks.findOpenAttemptId.mockResolvedValue({ ok: true, value: OTHER_ID });
  mocks.uploadGeneratedFile.mockResolvedValue(true);
  mocks.writeSnapshot.mockResolvedValue(true);
  mocks.createServiceClient.mockReturnValue(SERVICE);
  mocks.randomInt.mockImplementation((max: number) => mocks.realRandomInt!(max));
  mocks.generateExamWorkbook.mockImplementation((...args: unknown[]) => mocks.realGenerate!(...args));
  logs = vi.spyOn(console, "log").mockImplementation(() => {});
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const mock of Object.values(mocks)) if (typeof mock === "function" && "mockReset" in mock) mock.mockReset();
});

function generatedToken(): string {
  return (mocks.generateExamWorkbook.mock.calls[0][0] as { token: string }).token;
}

function expectNoTokenLogged(token: string) {
  for (const spy of [logs, errors]) {
    for (const args of spy.mock.calls) {
      const line = args.map(String).join(" ");
      expect(line).not.toContain(token);
      expect(line).not.toContain(tokenSha256Hex(token));
    }
  }
}

describe("startAttempt", () => {
  it("creates an open L01-P1 attempt, stores its file, and moves to the exam screen with the download", async () => {
    expect(await start()).toEqual({ redirected: `/exam/${ID}?download=1` });

    const token = generatedToken();
    expect(mocks.createAttempt).toHaveBeenCalledWith(SUPABASE, {
      itemId: "L01-P1",
      tokenSha256: tokenSha256Hex(token),
      templateVersion: CURRENT_TEMPLATE_VERSION,
    });
    expect(mocks.writeSnapshot).toHaveBeenCalledWith(
      SERVICE,
      ID,
      "user-1",
      expect.objectContaining({ version: 2, contentVersion: 2, hintQuota: 3, seed: expect.any(Number) }),
    );
    // The snapshot is written before the file is stored.
    expect(mocks.writeSnapshot.mock.invocationCallOrder[0]).toBeLessThan(mocks.uploadGeneratedFile.mock.invocationCallOrder[0]);
    const [client, attemptId, bytes] = mocks.uploadGeneratedFile.mock.calls[0] as [unknown, string, Uint8Array];
    expect(client).toBe(SUPABASE);
    expect(attemptId).toBe(ID);
    const reading = await readWorkbook(bytes);
    expect(reading.properties.WHE_AttemptToken).toBe(token);
    expect(reading.properties.WHE_ServerUrl).toBe("https://excel-practice-omega.vercel.app");
    expect(reading.properties.WHE_TemplateVersion).toBe(String(CURRENT_TEMPLATE_VERSION));
    expect(matchesTemplate(reading.vbaModuleHashes, CURRENT_TEMPLATE_VERSION)).toBe(true);
    expect(reading.sheets.Instructions.B2.value).toMatch(/^Level 1 · Practice 1/);
    expect(reading.sheets.Data.A1.value).toBe("Kode Batch");

    expect(mocks.ensureProfile).not.toHaveBeenCalled();
    expect(mocks.deleteOpenAttempt).not.toHaveBeenCalled();
    const lines = logs.mock.calls.map((args) => JSON.parse(String(args[0])));
    expect(lines).toEqual([
      expect.objectContaining({ event: "attempt.started", attemptId: ID, itemId: "L01-P1", tokenSha256: tokenSha256Hex(token).slice(0, 12) }),
    ]);
    expectNoTokenLogged(token);
  });

  it("uses the forwarded host when the request has no Origin header", async () => {
    mocks.headers.mockResolvedValue(new Headers({ host: "localhost:3000", "x-forwarded-proto": "http" }));
    await start();
    const input = mocks.generateExamWorkbook.mock.calls[0][0] as { serverUrl: string };
    expect(input.serverUrl).toBe("http://localhost:3000");
  });

  it("gives every Start a new token", async () => {
    await start();
    await start();
    const [first, second] = mocks.createAttempt.mock.calls.map(([, row]) => (row as { tokenSha256: string }).tokenSha256);
    expect(first).not.toBe(second);
  });

  it("sends a visitor without a session to Login and writes nothing", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    expect(await start()).toEqual({ redirected: "/login?next=%2Flevels" });
    expect(mocks.createAttempt).not.toHaveBeenCalled();
    expect(mocks.generateExamWorkbook).not.toHaveBeenCalled();
  });

  describe("without a profile", () => {
    beforeEach(() => {
      mocks.readTimeZone.mockResolvedValue({ ok: true, timeZone: null });
    });

    it("creates it with the browser's zone from the form, then starts", async () => {
      expect(await start()).toEqual({ redirected: `/exam/${ID}?download=1` });
      expect(mocks.ensureProfile).toHaveBeenCalledWith(SUPABASE, "user-1", "Asia/Jakarta");
    });

    it.each([
      ["no zone", { itemId: "L01-P1" }, null],
      ["an invalid zone", { itemId: "L01-P1", timeZone: "Mars/Olympus" }, null],
    ])("asks for a reload with %s, without a row", async (_, fields, expectedZone) => {
      mocks.ensureProfile.mockResolvedValue("skipped");
      expect(await start(form(fields))).toEqual({ status: "error", error: "profileMissing" });
      expect(mocks.ensureProfile).toHaveBeenCalledWith(SUPABASE, "user-1", expectedZone);
      expect(mocks.createAttempt).not.toHaveBeenCalled();
      expect(startMessages.profileMissing).toBeTruthy();
    });

    it("reports a profile insert that fails", async () => {
      mocks.ensureProfile.mockResolvedValue("failed");
      expect(await start()).toEqual({ status: "error", error: "startFailed" });
      expect(mocks.createAttempt).not.toHaveBeenCalled();
    });
  });

  it("reports a profile read that fails", async () => {
    mocks.readTimeZone.mockResolvedValue({ ok: false });
    expect(await start()).toEqual({ status: "error", error: "startFailed" });
    expect(mocks.createAttempt).not.toHaveBeenCalled();
  });

  it.each([
    ["the profile read throws", () => mocks.readTimeZone.mockRejectedValue(new TypeError("fetch failed"))],
    ["the profile insert throws", () => {
      mocks.readTimeZone.mockResolvedValue({ ok: true, timeZone: null });
      mocks.ensureProfile.mockRejectedValue(new TypeError("fetch failed"));
    }],
    ["the session read throws", () => mocks.getSessionUser.mockRejectedValue(new TypeError("fetch failed"))],
    ["the headers cannot be read", () => mocks.headers.mockRejectedValue(new Error("no request"))],
    ["the insert throws", () => mocks.createAttempt.mockRejectedValue(new TypeError("fetch failed"))],
  ])("answers startFailed when %s, and logs an event line", async (_, arrange) => {
    arrange();
    expect(await start()).toEqual({ status: "error", error: "startFailed" });
    expect(mocks.redirect).not.toHaveBeenCalled();
    const lines = errors.mock.calls.map((args) => JSON.parse(String(args[0])) as { event: string });
    expect(lines.length).toBeGreaterThan(0);
    for (const call of mocks.generateExamWorkbook.mock.calls) expectNoTokenLogged((call[0] as { token: string }).token);
  });

  type Generate = (seed: number, scenario: Scenario) => GeneratedExam;
  it.each<[string, (real: Generate) => Generate]>([
    ["is outside the exam schema", () => () => ({ cells: {}, questions: [] })],
    [
      "has points that do not sum to 100",
      (real) => (seed, scenario) => {
        const exam = real(seed, scenario);
        return { ...exam, questions: exam.questions.map((q, i) => (i === 0 ? { ...q, points: q.points - 5 } : q)) };
      },
    ],
    [
      "throws",
      () => () => {
        throw new RangeError("bad scenario");
      },
    ],
  ])("refuses an item whose generated exam %s: no workbook, no row", async (_, fake) => {
    const item = findItem("L01-P1")!.item;
    vi.spyOn(item, "generate").mockImplementation(fake(item.generate.bind(item)));
    expect(await start()).toEqual({ status: "error", error: "startFailed" });
    expect(mocks.generateExamWorkbook).not.toHaveBeenCalled();
    expect(mocks.createAttempt).not.toHaveBeenCalled();
    const lines = errors.mock.calls.map((args) => JSON.parse(String(args[0])));
    expect(lines).toEqual([
      expect.objectContaining({ event: "attempt.start_invalid_exam", itemId: "L01-P1", contentVersion: 2, scenarioId: expect.any(String) }),
    ]);
  });

  it("draws a seed and a scenario, writes that exam into the workbook, and stores its snapshot", async () => {
    const { level, item } = findItem("L01-P1")!;
    const generate = vi.spyOn(item, "generate");
    expect(await start()).toEqual({ redirected: `/exam/${ID}?download=1` });

    const snapshot = mocks.writeSnapshot.mock.calls[0][3] as ExamSnapshot;
    expect(examSnapshotSchema.safeParse(snapshot).success).toBe(true);
    const scenario = level.scenarios.find((s) => s.id === snapshot.scenarioId)!;
    expect(scenario).toBeDefined();
    expect(snapshot.contentVersion).toBe(level.contentVersion);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith(snapshot.seed, scenario);
    const exam = generate.mock.results[0].value as GeneratedExam;
    expect(snapshot.questions).toEqual(exam.questions);
    expect(snapshot.questions.map((q) => q.points)).toEqual([20, 25, 25, 30]);
    expect(snapshot).toMatchObject({ version: 2, contentVersion: 2, hintQuota: level.hintQuota });
    expect(snapshot.hintQuota).toBe(3);
    expect(snapshot.questions).toHaveLength(4);
    for (const question of snapshot.questions) {
      expect(question.hints).toHaveLength(3);
      expect(question.tip).toMatchObject({ id: expect.stringMatching(/^l01-/), title: expect.any(String), body: expect.any(String) });
    }

    const [, , bytes] = mocks.uploadGeneratedFile.mock.calls[0] as [unknown, string, Uint8Array];
    const reading = await readWorkbook(bytes);
    expect(reading.sheets.Instructions.B2.value).toBe(exam.cells.Instructions.B2);
    for (const [ref, value] of Object.entries(exam.cells.Data)) expect(reading.sheets.Data[ref]?.value, ref).toBe(value);
    for (const question of snapshot.questions) {
      for (const ref of Object.keys(question.key)) expect(reading.sheets.Data[ref]).toBeUndefined();
    }

    const [line] = logs.mock.calls.map((args) => JSON.parse(String(args[0])) as Record<string, unknown>);
    expect(line).toMatchObject({ event: "attempt.started", scenarioId: scenario.id, contentVersion: 2 });
    expect(Object.keys(line).sort()).toEqual(
      ["attemptId", "contentVersion", "event", "itemId", "scenarioId", "templateVersion", "tokenSha256"].sort(),
    );
  });

  it("gives two Starts their own seeds", async () => {
    await start();
    await start();
    const [first, second] = mocks.writeSnapshot.mock.calls.map((call) => call[3] as ExamSnapshot);
    expect(first.seed).not.toBe(second.seed);
  });

  it("uses the drawn seed and scenario index, not always the first scenario", async () => {
    const { level, item } = findItem("L01-P1")!;
    const draws = [123456789, 3];
    mocks.randomInt.mockImplementation(() => draws.shift());
    const generate = vi.spyOn(item, "generate");
    expect(await start()).toEqual({ redirected: `/exam/${ID}?download=1` });
    expect(mocks.randomInt.mock.calls).toEqual([[2 ** 32], [level.scenarios.length]]);
    expect(generate).toHaveBeenCalledWith(123456789, level.scenarios[3]);
    expect(mocks.writeSnapshot.mock.calls[0][3]).toMatchObject({ seed: 123456789, scenarioId: level.scenarios[3].id });
  });

  /** Runs `fn` with a level field replaced, then puts it back. */
  async function withLevel<K extends "scenarios" | "contentVersion">(key: K, value: unknown, fn: () => Promise<void>) {
    const level = findItem("L01-P1")!.level as unknown as Record<K, unknown>;
    const saved = level[key];
    level[key] = value;
    try {
      await fn();
    } finally {
      level[key] = saved;
    }
  }

  it("refuses a level without scenarios: nothing generated or created", async () => {
    const generate = vi.spyOn(findItem("L01-P1")!.item, "generate");
    await withLevel("scenarios", [], async () => {
      expect(await start()).toEqual({ status: "error", error: "startFailed" });
    });
    expect(generate).not.toHaveBeenCalled();
    expect(mocks.generateExamWorkbook).not.toHaveBeenCalled();
    expect(mocks.createAttempt).not.toHaveBeenCalled();
    const lines = errors.mock.calls.map((args) => JSON.parse(String(args[0])));
    expect(lines).toEqual([expect.objectContaining({ event: "attempt.start_no_scenarios", itemId: "L01-P1" })]);
  });

  it("refuses a snapshot outside its schema before generating the workbook", async () => {
    await withLevel("contentVersion", 0, async () => {
      expect(await start()).toEqual({ status: "error", error: "startFailed" });
    });
    expect(mocks.generateExamWorkbook).not.toHaveBeenCalled();
    expect(mocks.createAttempt).not.toHaveBeenCalled();
    const lines = errors.mock.calls.map((args) => JSON.parse(String(args[0])));
    expect(lines).toEqual([expect.objectContaining({ event: "attempt.start_invalid_exam", part: "snapshot" })]);
  });

  it.each([
    ["the write fails", () => mocks.writeSnapshot.mockResolvedValue(false), "write_failed"],
    ["the service env is missing", () => mocks.createServiceClient.mockReturnValue(null), "service_env_missing"],
    [
      "the service client cannot be created",
      () =>
        mocks.createServiceClient.mockImplementation(() => {
          throw new Error("bad key");
        }),
      "service_client_failed",
    ],
  ])("deletes the new row and stores no file when %s", async (_, arrange, code) => {
    arrange();
    expect(await start()).toEqual({ status: "error", error: "startFailed" });
    expect(mocks.deleteOpenAttempt).toHaveBeenCalledWith(SUPABASE, ID);
    expect(mocks.uploadGeneratedFile).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
    const lines = errors.mock.calls.map((args) => JSON.parse(String(args[0])));
    expect(lines).toEqual([{ event: "attempt.start_snapshot_failed", attemptId: ID, code, deleted: true }]);
  });

  it("refuses an unknown item", async () => {
    expect(await start(form({ itemId: "L09-P5", timeZone: "Asia/Jakarta" }))).toEqual({ status: "error", error: "startFailed" });
    expect(mocks.generateExamWorkbook).not.toHaveBeenCalled();
    expect(mocks.createAttempt).not.toHaveBeenCalled();
  });

  it("creates no row when generation fails, and logs only the 12-hex hash", async () => {
    mocks.generateExamWorkbook.mockRejectedValue(new Error("ENOENT: no such file"));
    expect(await start()).toEqual({ status: "error", error: "startFailed" });
    expect(mocks.createAttempt).not.toHaveBeenCalled();
    expect(mocks.uploadGeneratedFile).not.toHaveBeenCalled();
    const token = generatedToken();
    const [line] = errors.mock.calls.map((args) => JSON.parse(String(args[0])));
    expect(line).toMatchObject({ event: "attempt.generate_failed", tokenSha256: tokenSha256Hex(token).slice(0, 12) });
    expectNoTokenLogged(token);
  });

  it("deletes the row again when the file cannot be stored", async () => {
    mocks.uploadGeneratedFile.mockResolvedValue(false);
    expect(await start()).toEqual({ status: "error", error: "startFailed" });
    expect(mocks.deleteOpenAttempt).toHaveBeenCalledWith(SUPABASE, ID);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("deletes the row again when the upload throws", async () => {
    mocks.uploadGeneratedFile.mockRejectedValue(new TypeError("fetch failed"));
    expect(await start()).toEqual({ status: "error", error: "startFailed" });
    expect(mocks.deleteOpenAttempt).toHaveBeenCalledWith(SUPABASE, ID);
  });

  it("reports an insert that fails", async () => {
    mocks.createAttempt.mockResolvedValue({ ok: false, reason: "failed" });
    expect(await start()).toEqual({ status: "error", error: "startFailed" });
    expect(mocks.uploadGeneratedFile).not.toHaveBeenCalled();
  });

  it("refuses a second Start (unique index) and links to the attempt in progress", async () => {
    mocks.createAttempt.mockResolvedValue({ ok: false, reason: "open_attempt_exists" });
    expect(await start()).toEqual({ status: "blocked", attemptId: OTHER_ID });
    expect(mocks.findOpenAttemptId).toHaveBeenCalledWith(SUPABASE, "user-1");
    expect(mocks.uploadGeneratedFile).not.toHaveBeenCalled();
  });

  it("still refuses when the attempt in progress cannot be read", async () => {
    mocks.createAttempt.mockResolvedValue({ ok: false, reason: "open_attempt_exists" });
    mocks.findOpenAttemptId.mockResolvedValue({ ok: false });
    expect(await start()).toEqual({ status: "blocked", attemptId: null });
  });
});
