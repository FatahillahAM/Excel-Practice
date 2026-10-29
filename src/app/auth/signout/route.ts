import { NextResponse, type NextRequest } from "next/server";
import { signOut } from "../../../adapters/supabase/auth";

/** `POST /auth/signout` (Log out): ends this device's session, then Login. */
export async function POST(request: NextRequest): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== request.nextUrl.origin) {
    return Response.json({ ok: false, code: "FORBIDDEN" }, { status: 403 });
  }
  await signOut();
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), 303);
}
