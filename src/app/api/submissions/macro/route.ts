import { recordBridgeProofReceipt } from "../../../../adapters/supabase/bridge-proofs";
import { createServiceClient } from "../../../../adapters/supabase/service";
import { inspectMacroSubmission, type MacroInspection } from "./inspect";

/**
 * `POST /api/submissions/macro` (AD-6): the Finish macro posts the workbook's
 * bytes as `application/octet-stream` with header `X-Attempt-Token`. No session:
 * the token authenticates. The answer comes from the inspection alone (spike
 * S3). When the file holds a well-formed token, what the server read is also
 * recorded on the bridge proof row with that token's hash, through the
 * service-role client (AD-9); the log line says whether a row was updated.
 * No file bytes are stored.
 */
export async function POST(request: Request): Promise<Response> {
  const bytes = new Uint8Array(await request.arrayBuffer());
  const inspection = await inspectMacroSubmission(bytes, request.headers.get("x-attempt-token"));
  const proofRecorded = await recordProof(inspection);
  console.log(JSON.stringify({ ...inspection.log, proofRecorded }));
  return Response.json(inspection.body, { status: inspection.status });
}

/** Never throws: a failed write only shows as `proofRecorded: false`. */
async function recordProof(inspection: MacroInspection): Promise<boolean> {
  if (inspection.proof === null) return false;
  try {
    const service = createServiceClient();
    if (service === null) {
      console.error(JSON.stringify({ event: "bridge_proof.service_env_missing" }));
      return false;
    }
    return await recordBridgeProofReceipt(service, {
      tokenSha256: inspection.proof.tokenSha256,
      bytes: inspection.log.bytes,
      tokenMatches: inspection.log.tokenMatches,
      fingerprintMatches: inspection.log.fingerprintMatches,
      formulas: inspection.proof.formulas,
    });
  } catch (error) {
    console.error(
      JSON.stringify({ event: "bridge_proof.record_failed", code: error instanceof Error ? error.name : typeof error }),
    );
    return false;
  }
}
