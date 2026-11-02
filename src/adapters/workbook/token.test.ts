import { describe, expect, it } from "vitest";
import { ATTEMPT_TOKEN_RE } from "./generate";
import { newAttemptToken, tokenSha256, tokenSha256Hex } from "./token";

describe("attempt tokens", () => {
  it("are 32 random bytes in base64url, a new one each time", () => {
    const a = newAttemptToken();
    const b = newAttemptToken();
    expect(a).toMatch(ATTEMPT_TOKEN_RE);
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
    expect(a).not.toBe(b);
  });

  it("hash to 64 lowercase hex, and log as the first 12", () => {
    expect(tokenSha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(tokenSha256("abc")).toBe("ba7816bf8f01");
  });
});
