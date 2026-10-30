import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Placeholders only: no real address belongs in the repo.
const ALLOWED = "allowed.user@example.test";
const STRANGER = "someone.else@example.test";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
  ensureProfile: vi.fn(),
  getClaims: vi.fn(),
  readTimeZone: vi.fn(),
}));

vi.mock("./server", () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      signOut: mocks.signOut,
      getClaims: mocks.getClaims,
    },
    from: mocks.from,
  }),
}));

vi.mock("./profiles", () => ({ ensureProfile: mocks.ensureProfile, readTimeZone: mocks.readTimeZone }));

import { completeGoogleSignIn, getAccount, getSessionUser } from "./auth";

function signedInAs(email: string) {
  mocks.exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "user-1", email } }, error: null });
}

beforeEach(() => {
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.ensureProfile.mockResolvedValue("created");
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  mocks.exchangeCodeForSession.mockReset();
  mocks.signOut.mockReset();
  mocks.from.mockReset();
  mocks.ensureProfile.mockReset();
  mocks.getClaims.mockReset();
  mocks.readTimeZone.mockReset();
});

describe("completeGoogleSignIn", () => {
  it("lets the ALLOWED_EMAIL account in and creates its profile", async () => {
    vi.stubEnv("ALLOWED_EMAIL", ALLOWED);
    signedInAs(ALLOWED.toUpperCase());
    expect(await completeGoogleSignIn("code", "Asia/Jakarta")).toBe("success");
    expect(mocks.ensureProfile).toHaveBeenCalledWith(expect.anything(), "user-1", "Asia/Jakarta");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("signs any other account out again and leaves profiles untouched", async () => {
    vi.stubEnv("ALLOWED_EMAIL", ALLOWED);
    signedInAs(STRANGER);
    expect(await completeGoogleSignIn("code", "Asia/Jakarta")).toBe("not_allowed");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.ensureProfile).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"auth.not_allowed"'));
  });

  it.each([[""], ["   "]])("rejects everyone when ALLOWED_EMAIL is unset (%j) and logs it apart", async (value) => {
    vi.stubEnv("ALLOWED_EMAIL", value);
    signedInAs(ALLOWED);
    expect(await completeGoogleSignIn("code", "Asia/Jakarta")).toBe("not_allowed");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.ensureProfile).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"auth.allowed_email_unset"'));
  });

  it("signs out and reports an error when the profile cannot be written", async () => {
    vi.stubEnv("ALLOWED_EMAIL", ALLOWED);
    signedInAs(ALLOWED);
    mocks.ensureProfile.mockResolvedValue("failed");
    expect(await completeGoogleSignIn("code", "Asia/Jakarta")).toBe("error");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("reports an error when the code exchange fails", async () => {
    vi.stubEnv("ALLOWED_EMAIL", ALLOWED);
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { user: null }, error: { code: "bad_code_verifier" } });
    expect(await completeGoogleSignIn("code", "Asia/Jakarta")).toBe("error");
    expect(mocks.ensureProfile).not.toHaveBeenCalled();
  });
});

describe("getSessionUser", () => {
  it("returns the user from the session claims", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1", email: ALLOWED } }, error: null });
    expect(await getSessionUser()).toEqual({ id: "user-1", email: ALLOWED });
  });

  it.each(["", "  "])("treats an empty email claim %j as no email", async (email) => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1", email } }, error: null });
    expect(await getSessionUser()).toEqual({ id: "user-1", email: null });
  });

  it("is null without a session", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    expect(await getSessionUser()).toBeNull();
  });

  it("is null when the claims do not verify", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: { code: "bad_jwt" } });
    expect(await getSessionUser()).toBeNull();
  });
});

describe("getAccount", () => {
  it("returns the email and the profile's time zone", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user-1", email: ALLOWED } }, error: null });
    mocks.readTimeZone.mockResolvedValue({ ok: true, timeZone: "Asia/Jakarta" });
    expect(await getAccount()).toEqual({ email: ALLOWED, timeZone: { ok: true, timeZone: "Asia/Jakarta" } });
    expect(mocks.readTimeZone).toHaveBeenCalledWith(expect.anything(), "user-1");
  });

  it("reads nothing without a session", async () => {
    mocks.getClaims.mockResolvedValue({ data: null, error: null });
    expect(await getAccount()).toBeNull();
    expect(mocks.readTimeZone).not.toHaveBeenCalled();
  });
});
