import type { NextRequest } from "next/server";
import {
  callbackPageHtml,
  classifyOAuthError,
  normalizeTimeZone,
  safeNext,
  type AuthStatus,
} from "../../../adapters/supabase/auth-rules";
import { completeGoogleSignIn, signOut } from "../../../adapters/supabase/auth";

/**
 * `GET /auth/callback`: Google → Supabase → here, inside the Login popup.
 * Exchanges the code, re-checks `ALLOWED_EMAIL`, creates the profile on
 * first sign-in, then tells the opener the result and closes (or, opened as
 * a normal tab, navigates on itself).
 */
export async function GET(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;
  const next = safeNext(params.get("next"));

  let status: AuthStatus | null = classifyOAuthError({
    error: params.get("error"),
    errorCode: params.get("error_code"),
    errorDescription: params.get("error_description"),
  });
  if (status !== null) {
    console.warn(JSON.stringify({ event: "auth.oauth_error", status, code: params.get("error_code") }));
  } else {
    const code = params.get("code");
    try {
      status = code ? await completeGoogleSignIn(code, normalizeTimeZone(params.get("tz"))) : "error";
    } catch (error) {
      // The popup must still report back instead of showing Next's error page.
      console.error(
        JSON.stringify({ event: "auth.callback_threw", name: error instanceof Error ? error.name : typeof error }),
      );
      // Leave no half-made session behind an error report.
      await signOut().catch(() => undefined);
      status = "error";
    }
  }

  return new Response(callbackPageHtml(status, next), {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
