import { createHash, randomBytes } from "node:crypto";

/**
 * Attempt tokens (Consistency Conventions › IDs): 32 random bytes, base64url
 * without padding. The file carries the token (`WHE_AttemptToken`); the
 * database keeps only its SHA-256 (`attempts.token_sha256`); a log line keeps
 * only the first 12 hex of that hash.
 */

/** A new attempt token (matches `ATTEMPT_TOKEN_RE`). */
export function newAttemptToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Full lowercase hex SHA-256 of a token (64 hex): stored instead of the token, never logged. */
export function tokenSha256Hex(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** First 12 hex of the SHA-256 of a token: lets a log line be matched to a token without holding it. */
export function tokenSha256(token: string): string {
  return tokenSha256Hex(token).slice(0, 12);
}
