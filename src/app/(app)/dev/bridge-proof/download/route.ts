import { randomBytes } from "node:crypto";
import { UNAUTHENTICATED } from "../../../../../adapters/supabase/auth-rules";
import { getSessionUser } from "../../../../../adapters/supabase/auth";
import { createBridgeProof } from "../../../../../adapters/supabase/bridge-proofs";
import { createClient } from "../../../../../adapters/supabase/server";
import { generateExamWorkbook } from "../../../../../adapters/workbook/generate";
import { CURRENT_TEMPLATE_VERSION } from "../../../../../adapters/workbook/templates";
import { tokenSha256Hex } from "../../../../api/submissions/macro/inspect";
import { bridgeProofCells } from "../sample";

/** Macro-enabled workbook (`.xlsm`). */
const XLSM_CONTENT_TYPE = "application/vnd.ms-excel.sheet.macroEnabled.12";
const INTERNAL_ERROR = "INTERNAL_ERROR";

/**
 * `GET /dev/bridge-proof/download`: a new attempt token (32 random bytes,
 * base64url), a proof row with its SHA-256 for the signed-in user, then the
 * exam template patched with the token and this request's origin as
 * `WHE_ServerUrl` (AD-13), as a download. No row, no file.
 */
export async function GET(request: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return json({ ok: false, code: UNAUTHENTICATED }, 401);

  const token = randomBytes(32).toString("base64url");
  const hash = tokenSha256Hex(token);
  const created = await createBridgeProof(await createClient(), {
    tokenSha256: hash,
    templateVersion: CURRENT_TEMPLATE_VERSION,
  });
  if (!created) return json({ ok: false, code: INTERNAL_ERROR }, 500);

  let bytes: Uint8Array;
  try {
    ({ bytes } = await generateExamWorkbook({
      token,
      serverUrl: new URL(request.url).origin,
      cells: bridgeProofCells,
    }));
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "bridge_proof.generate_failed",
        tokenSha256: hash.slice(0, 12),
        name: error instanceof Error ? error.name : typeof error,
      }),
    );
    return json({ ok: false, code: INTERNAL_ERROR }, 500);
  }

  console.log(JSON.stringify({ event: "bridge_proof.downloaded", tokenSha256: hash.slice(0, 12) }));
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "content-type": XLSM_CONTENT_TYPE,
      "content-disposition": `attachment; filename="bridge-proof-${hash.slice(0, 12)}.xlsm"`,
      "content-length": String(bytes.byteLength),
      "cache-control": "no-store",
    },
  });
}

function json(body: object, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
