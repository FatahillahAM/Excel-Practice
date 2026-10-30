import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// `createServerClient` stand-in: a signed-in session whose refresh sets a cookie.
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: {
      cookies: { setAll: (c: { name: string; value: string; options: Record<string, unknown> }[]) => void };
    },
  ) => ({
    auth: {
      getClaims: async () => {
        options.cookies.setAll([{ name: "sb-test-auth-token", value: "refreshed", options: { path: "/" } }]);
        return { data: { claims: { sub: "user-1" } }, error: null };
      },
    },
  }),
}));

const ORIGIN = "http://app.test";

/** `updateSession` reads the env at import, so each case imports it fresh. */
async function loadProxy(env: { url: string; key: string }) {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", env.url);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", env.key);
  vi.resetModules();
  return (await import("./proxy")).updateSession;
}

const request = (path: string, init?: { method?: string }) => new NextRequest(`${ORIGIN}${path}`, init);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("updateSession without Supabase env (fails closed)", () => {
  const noEnv = { url: "", key: "" };

  it("redirects a page to Login with the path as next", async () => {
    const updateSession = await loadProxy(noEnv);
    const res = await updateSession(request("/levels?tab=tips"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/login?next=%2Flevels%3Ftab%3Dtips`);
  });

  it("answers an unknown API with 401 JSON", async () => {
    const updateSession = await loadProxy(noEnv);
    const res = await updateSession(request("/api/attempts/1/status"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, code: "UNAUTHENTICATED" });
  });

  it.each(["/api/submissions/macro", "/health", "/login", "/auth/callback"])("lets %s through", async (path) => {
    const updateSession = await loadProxy(noEnv);
    const res = await updateSession(request(path, { method: path.startsWith("/api/") ? "POST" : "GET" }));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("updateSession with a session", () => {
  const env = { url: "https://project.supabase.test", key: "sb_publishable_test" };

  it("sends /login on to a safe next, carrying the refreshed cookie", async () => {
    const updateSession = await loadProxy(env);
    const res = await updateSession(request("/login?next=//evil.com"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/dashboard`);
    expect(res.cookies.get("sb-test-auth-token")?.value).toBe("refreshed");
  });

  it("sends /login on to a relative next", async () => {
    const updateSession = await loadProxy(env);
    const res = await updateSession(request("/login?next=%2Flevels"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/levels`);
  });

  it("lets a protected page through with the refreshed cookie", async () => {
    const updateSession = await loadProxy(env);
    const res = await updateSession(request("/levels"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.cookies.get("sb-test-auth-token")?.value).toBe("refreshed");
  });
});
