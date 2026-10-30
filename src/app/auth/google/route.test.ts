import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ startGoogleSignIn: vi.fn() }));
vi.mock("../../../adapters/supabase/auth", () => mocks);

import { GET } from "./route";

afterEach(() => {
  vi.restoreAllMocks();
  mocks.startGoogleSignIn.mockReset();
});

describe("GET /auth/google", () => {
  it("answers the 502 error page when starting sign-in throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.startGoogleSignIn.mockRejectedValue(new Error("env missing"));
    const res = await GET(new NextRequest("http://app.test/auth/google?next=%2Flevels"));
    expect(res.status).toBe(502);
    expect(await res.text()).toContain('"status":"error"');
  });

  it("redirects to Google with a sanitized next and the zone in the callback URL", async () => {
    mocks.startGoogleSignIn.mockResolvedValue("https://accounts.google.test/o/oauth2/auth");
    const res = await GET(new NextRequest("http://app.test/auth/google?next=//evil.com&tz=Asia%2FJakarta"));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://accounts.google.test/o/oauth2/auth");
    expect(mocks.startGoogleSignIn).toHaveBeenCalledWith(
      "http://app.test/auth/callback?next=%2F&tz=Asia%2FJakarta",
    );
  });
});
