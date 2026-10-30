import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BRIDGE_PROOFS_LISTED,
  MAX_PROOF_FORMULAS,
  createBridgeProof,
  listBridgeProofs,
  recordBridgeProofReceipt,
  type BridgeProofReceipt,
} from "./bridge-proofs";

type PgError = { code: string; message: string } | null;

const HASH = "a".repeat(64);

afterEach(() => {
  vi.restoreAllMocks();
});

function quietErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

describe("createBridgeProof", () => {
  function fakeClient(insert: () => Promise<{ error: PgError }>) {
    const insertSpy = vi.fn(insert);
    const from = vi.fn(() => ({ insert: insertSpy }));
    return { client: { from } as unknown as SupabaseClient, from, insert: insertSpy };
  }

  it("inserts only the hash and the template version (user_id is the column default)", async () => {
    const { client, from, insert } = fakeClient(async () => ({ error: null }));
    expect(await createBridgeProof(client, { tokenSha256: HASH, templateVersion: 1 })).toBe(true);
    expect(from).toHaveBeenCalledWith("bridge_proofs");
    expect(insert).toHaveBeenCalledWith({ token_sha256: HASH, template_version: 1 });
  });

  it("is false when the insert fails or throws, and logs no hash", async () => {
    const error = quietErrors();
    const failed = fakeClient(async () => ({ error: { code: "42501", message: "denied" } }));
    expect(await createBridgeProof(failed.client, { tokenSha256: HASH, templateVersion: 1 })).toBe(false);
    const threw = fakeClient(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await createBridgeProof(threw.client, { tokenSha256: HASH, templateVersion: 1 })).toBe(false);
    for (const [line] of error.mock.calls) expect(String(line)).not.toContain(HASH);
  });
});

describe("listBridgeProofs", () => {
  function fakeClient(result: { data: unknown; error: PgError }) {
    const calls: Record<string, unknown[]> = {};
    const query = {
      select: (...args: unknown[]) => ((calls.select = args), query),
      eq: (...args: unknown[]) => ((calls.eq = args), query),
      order: (...args: unknown[]) => ((calls.order = args), query),
      limit: async (...args: unknown[]) => ((calls.limit = args), result),
    };
    return { client: { from: vi.fn(() => query) } as unknown as SupabaseClient, calls };
  }

  it("reads the user's newest rows and shortens the hash to 12 hex", async () => {
    const row = {
      token_sha256: "0123456789ab".padEnd(64, "f"),
      template_version: 1,
      created_at: "2026-10-30T01:00:00+00:00",
      received_at: "2026-10-30T01:05:00+00:00",
      receive_count: 2,
      bytes: 34567,
      token_matches: true,
      fingerprint_matches: true,
      formulas: [{ sheet: "Data", ref: "I2", formula: 'SUMIFS(E2:E11,B2:B11,"Lini A",C2:C11,"Pagi")' }, { bad: 1 }],
    };
    const { client, calls } = fakeClient({ data: [row], error: null });

    expect(await listBridgeProofs(client, "user-1")).toEqual([
      {
        tokenSha256Prefix: "0123456789ab",
        templateVersion: 1,
        createdAt: row.created_at,
        receivedAt: row.received_at,
        receiveCount: 2,
        bytes: 34567,
        tokenMatches: true,
        fingerprintMatches: true,
        formulas: [{ sheet: "Data", ref: "I2", formula: 'SUMIFS(E2:E11,B2:B11,"Lini A",C2:C11,"Pagi")' }],
      },
    ]);
    expect(calls.eq).toEqual(["user_id", "user-1"]);
    expect(calls.order).toEqual(["created_at", { ascending: false }]);
    expect(calls.limit).toEqual([BRIDGE_PROOFS_LISTED]);
    expect(BRIDGE_PROOFS_LISTED).toBe(5);
  });

  it("maps a row that was never posted", async () => {
    const { client } = fakeClient({
      data: [
        {
          token_sha256: HASH,
          template_version: 1,
          created_at: "2026-10-30T01:00:00+00:00",
          received_at: null,
          receive_count: 0,
          bytes: null,
          token_matches: null,
          fingerprint_matches: null,
          formulas: null,
        },
      ],
      error: null,
    });
    expect(await listBridgeProofs(client, "user-1")).toMatchObject([
      { receivedAt: null, receiveCount: 0, tokenMatches: null, fingerprintMatches: null, formulas: [] },
    ]);
  });

  it("is null when the read fails", async () => {
    quietErrors();
    const { client } = fakeClient({ data: null, error: { code: "PGRST301", message: "jwt" } });
    expect(await listBridgeProofs(client, "user-1")).toBeNull();
  });
});

describe("recordBridgeProofReceipt", () => {
  const receipt = (formulaCount: number): BridgeProofReceipt => ({
    tokenSha256: HASH,
    bytes: 12345,
    tokenMatches: true,
    fingerprintMatches: false,
    formulas: Array.from({ length: formulaCount }, (_, i) => ({ sheet: "Data", ref: `I${i + 2}`, formula: `SUM(E${i + 2})` })),
  });

  function fakeService(rpc: (...args: unknown[]) => Promise<{ data: unknown; error: PgError }>) {
    const spy = vi.fn(rpc);
    return { client: { rpc: spy } as unknown as SupabaseClient, rpc: spy };
  }

  it("updates the row by hash through the receipt function", async () => {
    const { client, rpc } = fakeService(async () => ({ data: true, error: null }));
    expect(await recordBridgeProofReceipt(client, receipt(1))).toBe(true);
    expect(rpc).toHaveBeenCalledWith("record_bridge_proof_receipt", {
      p_token_sha256: HASH,
      p_bytes: 12345,
      p_token_matches: true,
      p_fingerprint_matches: false,
      p_formulas: [{ sheet: "Data", ref: "I2", formula: "SUM(E2)" }],
    });
  });

  it(`keeps at most ${MAX_PROOF_FORMULAS} formula cells, the first ones`, async () => {
    const { client, rpc } = fakeService(async () => ({ data: true, error: null }));
    await recordBridgeProofReceipt(client, receipt(MAX_PROOF_FORMULAS + 7));
    const sent = (rpc.mock.calls[0][1] as { p_formulas: { ref: string }[] }).p_formulas;
    expect(MAX_PROOF_FORMULAS).toBe(20);
    expect(sent).toHaveLength(MAX_PROOF_FORMULAS);
    expect(sent[0].ref).toBe("I2");
    expect(sent.at(-1)?.ref).toBe(`I${MAX_PROOF_FORMULAS + 1}`);
  });

  it("is false when no row has the hash", async () => {
    const { client } = fakeService(async () => ({ data: false, error: null }));
    expect(await recordBridgeProofReceipt(client, receipt(0))).toBe(false);
  });

  it("never throws: a database error or a rejected call is false", async () => {
    const error = quietErrors();
    const failed = fakeService(async () => ({ data: null, error: { code: "PGRST202", message: "missing" } }));
    await expect(recordBridgeProofReceipt(failed.client, receipt(1))).resolves.toBe(false);
    const threw = fakeService(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(recordBridgeProofReceipt(threw.client, receipt(1))).resolves.toBe(false);
    expect(error).toHaveBeenCalledTimes(2);
    for (const [line] of error.mock.calls) expect(String(line)).not.toContain(HASH);
  });
});
