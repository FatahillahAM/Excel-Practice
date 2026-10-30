import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ completeGoogleSignIn: vi.fn(), signOut: vi.fn() }));
vi.mock("../../../adapters/supabase/auth", () => mocks);

import { GET } from "./route";

const ORIGIN = "http://app.test";

/** The `{ message, fallback }` object the callback page inlines for its script. */
async function payload(res: Response): Promise<{ message: { status: string; next: string }; fallback: string }> {
  const html = await res.text();
  const json = /var p = (\{.*\});/.exec(html)?.[1];
  expect(json, html).toBeDefined();
  return JSON.parse(json!);
}

afterEach(() => {
  vi.restoreAllMocks();
  mocks.completeGoogleSignIn.mockReset();
  mocks.signOut.mockReset();
});

describe("GET /auth/callback", () => {
  it("sanitizes next and lands a cancel on Login", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const res = await GET(new NextRequest(`${ORIGIN}/auth/callback?error=access_denied&next=//evil.com`));
    expect(res.headers.get("content-type")).toContain("text/html");
    const p = await payload(res);
    expect(p.message).toMatchObject({ type: "whe-auth", status: "cancelled", next: "/dashboard" });
    expect(p.fallback).toBe("/login");
    expect(mocks.completeGoogleSignIn).not.toHaveBeenCalled();
  });

  it("reports an error page (not Next's) when sign-in throws, and signs out", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.completeGoogleSignIn.mockRejectedValue(new Error("boom"));
    mocks.signOut.mockResolvedValue(undefined);
    const res = await GET(new NextRequest(`${ORIGIN}/auth/callback?code=abc&next=%2Flevels&tz=Asia%2FJakarta`));
    expect(res.status).toBe(200);
    const p = await payload(res);
    expect(p.message).toMatchObject({ status: "error", next: "/levels" });
    expect(p.fallback).toBe("/login?error=error&next=%2Flevels");
    expect(mocks.completeGoogleSignIn).toHaveBeenCalledWith("abc", "Asia/Jakarta");
    expect(mocks.signOut).toHaveBeenCalled();
  });

  it("passes a successful sign-in on to next", async () => {
    mocks.completeGoogleSignIn.mockResolvedValue("success");
    const p = await payload(await GET(new NextRequest(`${ORIGIN}/auth/callback?code=abc&next=%2Flevels`)));
    expect(p.message).toMatchObject({ status: "success", next: "/levels" });
    expect(p.fallback).toBe("/levels");
    expect(mocks.completeGoogleSignIn).toHaveBeenCalledWith("abc", null);
  });
});
