import type { SupabaseClient } from "@supabase/supabase-js";
import { findAttemptByTokenHash, markReceived, storeSubmissionFile } from "../../../adapters/supabase/attempts";
import { createServiceClient } from "../../../adapters/supabase/service";
import { workbookPort } from "../../../adapters/workbook/submission";
import type { SubmissionPorts } from "../../../core/submission";
import { errorName, type ChannelKind, type FaultLog } from "./http";

/**
 * `submit()`'s ports on the service-role client (AD-9), for both submission
 * routes. The client is created on the first port call, so a file refused in
 * steps (1)–(2) never needs the secret key; a missing key or a client that
 * cannot be created fails every port and is reported by `fault()` as
 * `<channel>.service_env_missing` / `<channel>.service_client_failed`.
 *
 * `ownerId` (upload): an attempt whose `user_id` is not the session user's is
 * treated as not found, so another user's file is `NOT_THIS_ATTEMPT` (AD-6
 * step 3), like a token no attempt has. The macro passes none: its token is
 * the only credential.
 */
export function serviceSubmissionPorts(
  channel: ChannelKind,
  ownerId: string | null = null,
): { ports: SubmissionPorts; fault: () => FaultLog | null } {
  let service: SupabaseClient | undefined;
  let serviceFault: FaultLog | null = null;
  const serviceClient = (): SupabaseClient | null => {
    if (service !== undefined) return service;
    if (serviceFault !== null) return null;
    try {
      const client = createServiceClient();
      if (client === null) serviceFault = { event: `${channel}.service_env_missing` };
      else service = client;
    } catch (error) {
      serviceFault = { event: `${channel}.service_client_failed`, code: errorName(error) };
    }
    return service ?? null;
  };

  const ports: SubmissionPorts = {
    workbook: workbookPort,
    attempts: {
      findByTokenHash: async (hash) => {
        const client = serviceClient();
        if (client === null) return { ok: false };
        const found = await findAttemptByTokenHash(client, hash);
        if (!found.ok || found.value === null) return found;
        if (ownerId !== null && found.value.userId !== ownerId) return { ok: true, value: null };
        const { id, status, templateVersion } = found.value;
        return { ok: true, value: { id, status, templateVersion } };
      },
      markReceived: async (attemptId) => {
        const client = serviceClient();
        return client === null ? { ok: false } : markReceived(client, attemptId);
      },
    },
    files: {
      storeSubmission: async (attemptId, n, file) => {
        const client = serviceClient();
        if (client === null) return "failed";
        // Upsert: `submit()` stores only while the attempt is `open` (never for a duplicate).
        const stored = await storeSubmissionFile(client, attemptId, n, file, { replace: true });
        return stored === "failed" ? "failed" : "stored";
      },
    },
  };
  return { ports, fault: () => serviceFault };
}
