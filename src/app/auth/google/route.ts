import { NextResponse, type NextRequest } from "next/server";
import { callbackPageHtml, normalizeTimeZone, safeNext } from "@/adapters/supabase/auth-rules";
import { startGoogleSignIn } from "@/adapters/supabase/auth";

/**
 * `GET /auth/google?next=…&tz=…`: opened in the Login popup. Starts the
 * Google OAuth flow (PKCE verifier in a cookie) and sends the popup to
 * Google; `next` and the browser time zone ride along in the callback URL.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const callback = new URL("/auth/callback", request.nextUrl.origin);
  callback.searchParams.set("next", next);
  const tz = normalizeTimeZone(request.nextUrl.searchParams.get("tz"));
  if (tz) callback.searchParams.set("tz", tz);

  const url = await startGoogleSignIn(callback.toString());
  if (!url) {
    return new Response(callbackPageHtml("error", next), {
      status: 502,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return NextResponse.redirect(url, { status: 303, headers: { "cache-control": "no-store" } });
}
