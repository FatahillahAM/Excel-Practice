import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `bridge_proofs` (migration `20261030000001`): the end-to-end bridge proof of
 * epic fondasi. A download creates a row through the user's session; the Finish
 * macro's POST records what the server read through the service-role client.
 * Rows hold the SHA-256 of the attempt token, never the token. Dropped in epic 2
 * once `attempts` exists.
 */

/** One formula cell the server read from a posted workbook. */
export interface ProofFormula {
  sheet: string;
  /** A1 reference (`I2`). */
  ref: string;
  /** Normalized formula text (`readWorkbook`), without the leading `=`. */
  formula: string;
}

export interface BridgeProof {
  /** First 12 hex of the token's SHA-256, as in the macro route's log line. */
  tokenSha256: string;
  templateVersion: number;
  createdAt: string;
  receivedAt: string | null;
  receiveCount: number;
  bytes: number | null;
  tokenMatches: boolean | null;
  fingerprintMatches: boolean | null;
  formulas: ProofFormula[];
}

export interface BridgeProofReceipt {
  /** Full lowercase hex SHA-256 of the file's `WHE_AttemptToken` (64 hex). */
  tokenSha256: string;
  bytes: number;
  tokenMatches: boolean;
  fingerprintMatches: boolean;
  formulas: readonly ProofFormula[];
}

/** At most this many formula cells are kept per receipt. */
export const MAX_PROOF_FORMULAS = 20;
export const BRIDGE_PROOFS_LISTED = 5;

const TABLE = "bridge_proofs";
const RECORD_RECEIPT_FN = "record_bridge_proof_receipt";

/**
 * Creates the signed-in user's proof row for a new download (`user_id` comes
 * from the column default, `auth.uid()`). `false` when the insert failed.
 */
export async function createBridgeProof(
  supabase: SupabaseClient,
  proof: { tokenSha256: string; templateVersion: number },
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from(TABLE)
      .insert({ token_sha256: proof.tokenSha256, template_version: proof.templateVersion });
    if (!error) return true;
    console.error(JSON.stringify({ event: "bridge_proof.create_failed", code: error.code ?? "unknown" }));
  } catch (error) {
    console.error(JSON.stringify({ event: "bridge_proof.create_failed", code: errorName(error) }));
  }
  return false;
}

/** The signed-in user's latest proofs, newest first (RLS: owner-only); `null` when the read failed. */
export async function listBridgeProofs(supabase: SupabaseClient, userId: string): Promise<BridgeProof[] | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select(
        "token_sha256, template_version, created_at, received_at, receive_count, bytes, token_matches, fingerprint_matches, formulas",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(BRIDGE_PROOFS_LISTED);
    if (error) {
      console.error(JSON.stringify({ event: "bridge_proof.list_failed", code: error.code ?? "unknown" }));
      return null;
    }
    return ((data ?? []) as ProofRow[]).map(toBridgeProof);
  } catch (error) {
    console.error(JSON.stringify({ event: "bridge_proof.list_failed", code: errorName(error) }));
    return null;
  }
}

/**
 * Records one Finish on the row with this token hash, through the service-role
 * client: server time, `receive_count + 1`, the size, both matches and the first
 * `MAX_PROOF_FORMULAS` formula cells. `true` when a row was updated; `false` for
 * a token no download issued or any database error. Never throws: the macro's
 * answer comes from the inspection alone.
 */
export async function recordBridgeProofReceipt(
  service: SupabaseClient,
  receipt: BridgeProofReceipt,
): Promise<boolean> {
  try {
    const { data, error } = await service.rpc(RECORD_RECEIPT_FN, {
      p_token_sha256: receipt.tokenSha256,
      p_bytes: receipt.bytes,
      p_token_matches: receipt.tokenMatches,
      p_fingerprint_matches: receipt.fingerprintMatches,
      p_formulas: receipt.formulas.slice(0, MAX_PROOF_FORMULAS).map(({ sheet, ref, formula }) => ({ sheet, ref, formula })),
    });
    if (error) {
      console.error(JSON.stringify({ event: "bridge_proof.record_failed", code: error.code ?? "unknown" }));
      return false;
    }
    return data === true;
  } catch (error) {
    console.error(JSON.stringify({ event: "bridge_proof.record_failed", code: errorName(error) }));
    return false;
  }
}

interface ProofRow {
  token_sha256: string;
  template_version: number;
  created_at: string;
  received_at: string | null;
  receive_count: number;
  bytes: number | null;
  token_matches: boolean | null;
  fingerprint_matches: boolean | null;
  formulas: unknown;
}

function toBridgeProof(row: ProofRow): BridgeProof {
  return {
    tokenSha256: row.token_sha256.slice(0, 12),
    templateVersion: row.template_version,
    createdAt: row.created_at,
    receivedAt: row.received_at,
    receiveCount: row.receive_count,
    bytes: row.bytes,
    tokenMatches: row.token_matches,
    fingerprintMatches: row.fingerprint_matches,
    formulas: Array.isArray(row.formulas) ? row.formulas.filter(isProofFormula) : [],
  };
}

function isProofFormula(value: unknown): value is ProofFormula {
  const v = value as Partial<ProofFormula> | null;
  return typeof v === "object" && v !== null && typeof v.sheet === "string" && typeof v.ref === "string" && typeof v.formula === "string";
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
