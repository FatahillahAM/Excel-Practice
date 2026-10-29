import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("../../../adapters/supabase/auth", () => mocks);

import { POST } from "./route";

const ORIGIN = "http://app.test";
const post = (origin?: string) =>
  POST(
    new NextRequest(`${ORIGIN}/auth/signout`, {
      method: "POST",
      headers: origin ? { origin } : {},
    }),
  );

afterEach(() => {
  mocks.signOut.mockReset();
});

describe("POST /auth/signout", () => {
  it("refuses a cross-origin request without signing out", async () => {
    const res = await post("https://evil.test");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, code: "FORBIDDEN" });
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("signs out and sends a same-origin request to Login", async () => {
    mocks.signOut.mockResolvedValue(undefined);
    const res = await post(ORIGIN);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/login`);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });
});
