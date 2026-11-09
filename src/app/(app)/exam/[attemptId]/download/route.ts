import { downloadGeneratedFile, readAttempt, XLSM_CONTENT_TYPE } from "@/adapters/supabase/attempts";
import { getSessionUser } from "@/adapters/supabase/auth";
import { UNAUTHENTICATED } from "@/adapters/supabase/auth-rules";
import { createClient } from "@/adapters/supabase/server";

const NOT_FOUND = "NOT_FOUND";
const INTERNAL_ERROR = "INTERNAL_ERROR";

/**
 * `GET /exam/<attemptId>/download`: the workbook Start generated and stored
 * for this attempt, byte for byte (AD-4: re-download serves those bytes).
 * Under `/exam`, not `/api`, so a visitor without a session goes to Login
 * (the proxy). The bytes stream through the user's session and Storage RLS;
 * someone else's attempt reads as missing.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }): Promise<Response> {
  const { attemptId } = await params;
  const user = await getSessionUser();
  if (!user) return json({ ok: false, code: UNAUTHENTICATED }, 401);

  const supabase = await createClient();
  const attempt = await readAttempt(supabase, attemptId);
  if (!attempt.ok) return json({ ok: false, code: INTERNAL_ERROR }, 500);
  if (attempt.value === null) return json({ ok: false, code: NOT_FOUND }, 404);

  const bytes = await downloadGeneratedFile(supabase, attempt.value.id);
  if (bytes === null) return json({ ok: false, code: INTERNAL_ERROR }, 500);

  const shortId = attempt.value.id.replaceAll("-", "").slice(0, 12).toLowerCase();
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "content-type": XLSM_CONTENT_TYPE,
      "content-disposition": `attachment; filename="${attempt.value.itemId}-${shortId}.xlsm"`,
      "content-length": String(bytes.byteLength),
      "cache-control": "no-store",
    },
  });
}

function json(body: object, status: number): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}
