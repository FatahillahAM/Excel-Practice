import { describe, expect, it } from "vitest";
import {
  callbackFallbackUrl,
  callbackPageHtml,
  classifyOAuthError,
  isAllowedEmail,
  isApiPath,
  isPublicPath,
  jsonForScript,
  loginRedirectPath,
  normalizeTimeZone,
  safeNext,
} from "./auth-rules";

describe("safeNext", () => {
  it.each([
    ["/", "/"],
    ["/levels", "/levels"],
    ["/levels/03?tab=tips#t2", "/levels/03?tab=tips#t2"],
    ["/history/", "/history/"],
  ])("keeps the relative path %s", (raw, expected) => {
    expect(safeNext(raw)).toBe(expected);
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["//evil.com"],
    ["//evil.com/path"],
    ["/\\evil.com"],
    ["/\\/evil.com"],
    ["https://evil.com"],
    ["http://localhost:3000/levels"],
    ["javascript:alert(1)"],
    ["levels"],
    ["/\tevil"],
    ["/\n/evil.com"],
    [" /levels"],
    ["/" + "a".repeat(3000)],
  ])("replaces %j with /", (raw) => {
    expect(safeNext(raw)).toBe("/");
  });

  it("never sends sign-in back to Login or the OAuth routes", () => {
    expect(safeNext("/login")).toBe("/");
    expect(safeNext("/login?next=/x")).toBe("/");
    expect(safeNext("/auth/callback?code=1")).toBe("/");
    expect(safeNext("/auth")).toBe("/");
    expect(safeNext("/authors")).toBe("/authors");
  });

  it("resolves dot segments without leaving the origin", () => {
    expect(safeNext("/a/../levels")).toBe("/levels");
    expect(safeNext("/../../evil.com")).toBe("/evil.com");
  });
});

describe("isAllowedEmail", () => {
  it("matches case-insensitively and ignores surrounding whitespace", () => {
    expect(isAllowedEmail("Someone@Gmail.com", "someone@gmail.com")).toBe(true);
    expect(isAllowedEmail("someone@gmail.com", "  SOMEONE@gmail.com \n")).toBe(true);
  });

  it("rejects any other email", () => {
    expect(isAllowedEmail("other@gmail.com", "someone@gmail.com")).toBe(false);
    expect(isAllowedEmail("someone@gmail.com.evil", "someone@gmail.com")).toBe(false);
  });

  it("allows nobody when either side is missing or empty", () => {
    expect(isAllowedEmail("someone@gmail.com", undefined)).toBe(false);
    expect(isAllowedEmail("someone@gmail.com", "")).toBe(false);
    expect(isAllowedEmail("someone@gmail.com", "   ")).toBe(false);
    expect(isAllowedEmail(undefined, "someone@gmail.com")).toBe(false);
    expect(isAllowedEmail("", "")).toBe(false);
  });
});

describe("classifyOAuthError", () => {
  const none = { error: null, errorCode: null, errorDescription: null };

  it("is null without error parameters", () => {
    expect(classifyOAuthError(none)).toBeNull();
  });

  it("maps the allowlist hook's rejection to not_allowed", () => {
    expect(
      classifyOAuthError({
        error: "server_error",
        errorCode: "unexpected_failure",
        errorDescription: "not_allowlisted: this account is not allowed to sign up",
      }),
    ).toBe("not_allowed");
    expect(
      classifyOAuthError({ error: "access_denied", errorCode: null, errorDescription: "Not_Allowlisted" }),
    ).toBe("not_allowed");
  });

  it("maps Google's consent cancel to cancelled", () => {
    expect(classifyOAuthError({ ...none, error: "access_denied" })).toBe("cancelled");
  });

  it("maps anything else to error", () => {
    expect(classifyOAuthError({ ...none, error: "server_error", errorDescription: "Unable to exchange" })).toBe(
      "error",
    );
    expect(classifyOAuthError({ ...none, errorCode: "bad_oauth_state" })).toBe("error");
  });
});

describe("normalizeTimeZone", () => {
  it("accepts IANA zones", () => {
    expect(normalizeTimeZone("Asia/Jakarta")).toBe("Asia/Jakarta");
    expect(normalizeTimeZone("America/Argentina/Buenos_Aires")).toBe("America/Argentina/Buenos_Aires");
    expect(normalizeTimeZone("UTC")).toBe("UTC");
    expect(normalizeTimeZone(" Europe/Berlin ")).toBe("Europe/Berlin");
  });

  it.each([[null], [undefined], [""], ["Mars/Olympus"], ["Asia/Jakarta; drop table"], ["x".repeat(65)]])(
    "rejects %j",
    (raw) => {
      expect(normalizeTimeZone(raw)).toBeNull();
    },
  );
});

describe("callback result mapping", () => {
  it("lands on next after success", () => {
    expect(callbackFallbackUrl("success", "/levels")).toBe("/levels");
    expect(callbackFallbackUrl("success", "/")).toBe("/");
  });

  it("lands on Login with the reason after a failure", () => {
    expect(callbackFallbackUrl("not_allowed", "/")).toBe("/login?error=not_allowed");
    expect(callbackFallbackUrl("error", "/levels")).toBe("/login?error=error&next=%2Flevels");
  });

  it("lands on Login without an error after a cancel", () => {
    expect(callbackFallbackUrl("cancelled", "/")).toBe("/login");
    expect(callbackFallbackUrl("cancelled", "/levels")).toBe("/login?next=%2Flevels");
  });

  it("posts the result to a same-origin opener only, then closes", () => {
    const html = callbackPageHtml("not_allowed", "/levels");
    expect(html).toContain('"type":"whe-auth"');
    expect(html).toContain('"status":"not_allowed"');
    expect(html).toContain("postMessage(p.message, window.location.origin)");
    expect(html).toContain("window.close()");
    expect(html).toContain('"fallback":"/login?error=not_allowed\\u0026next=%2Flevels"');
  });

  it("cannot be broken out of the inline script", () => {
    const html = callbackPageHtml("success", "/</script><script>alert(1)</script>");
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(jsonForScript({ a: "</script>\u2028" })).toBe('{"a":"\\u003c/script\\u003e\\u2028"}');
  });
});

describe("public paths", () => {
  it.each([
    "/login",
    "/auth/google",
    "/auth/callback",
    "/auth/signout",
    "/api/submissions/macro",
    "/api/submissions/macro/",
    "/health",
    "/favicon.ico",
    "/_next/static/chunks/main.js",
    "/logo.svg",
    "/fonts/inter.woff2",
  ])("%s needs no session", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each([
    "/",
    "/levels",
    "/history",
    "/healthz",
    "/health/details",
    "/authors",
    "/login-help",
    "/api/submissions/upload",
    "/api/submissions/macro-v2",
    "/api/attempts/1/status",
    "/api/export.json",
    "/dev/bridge-proof",
  ])("%s needs a session", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });

  it("separates APIs (401 JSON) from pages (redirect)", () => {
    expect(isApiPath("/api/submissions/upload")).toBe(true);
    expect(isApiPath("/api")).toBe(true);
    expect(isApiPath("/apiary")).toBe(false);
    expect(isApiPath("/levels")).toBe(false);
  });

  it("redirects to Login with the requested path as next", () => {
    expect(loginRedirectPath("/levels", "?tab=tips")).toBe("/login?next=%2Flevels%3Ftab%3Dtips");
    expect(loginRedirectPath("/", "")).toBe("/login");
  });
});
