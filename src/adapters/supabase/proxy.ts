import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { UNAUTHENTICATED, isApiPath, isPublicPath, loginRedirectPath, safeNext } from "./auth-rules";

const hasEnvVars = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

/**
 * Refreshes the Supabase session cookie and guards routes (CAP-17): without
 * a session, pages redirect to `/login?next=<path>` and APIs answer 401 JSON;
 * public paths (`auth-rules.isPublicPath`) pass. `/login` with a session goes
 * to `next` (or `/`).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { pathname, search } = request.nextUrl;

  // Without Supabase env there is no session to find: fail closed.
  if (!hasEnvVars) {
    return guard(request, supabaseResponse, false, pathname, search);
  }

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  // IMPORTANT: return supabaseResponse as it is, or copy its cookies onto any
  // other response (guard() does), so the browser and server keep the same
  // session.
  return guard(request, supabaseResponse, signedIn, pathname, search);
}

function guard(
  request: NextRequest,
  supabaseResponse: NextResponse,
  signedIn: boolean,
  pathname: string,
  search: string,
): NextResponse {
  if (signedIn && pathname === "/login") {
    const next = safeNext(request.nextUrl.searchParams.get("next"));
    return withCookies(NextResponse.redirect(new URL(next, request.url)), supabaseResponse);
  }
  if (signedIn || isPublicPath(pathname)) return supabaseResponse;

  if (isApiPath(pathname)) {
    return withCookies(
      NextResponse.json({ ok: false, code: UNAUTHENTICATED }, { status: 401 }),
      supabaseResponse,
    );
  }
  return withCookies(
    NextResponse.redirect(new URL(loginRedirectPath(pathname, search), request.url)),
    supabaseResponse,
  );
}

/** Carries cookies set while refreshing the session onto another response. */
function withCookies(response: NextResponse, from: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) response.cookies.set(cookie);
  return response;
}
