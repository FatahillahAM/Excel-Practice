import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensureProfile } from "./profiles";

type PgError = { code: string; message: string } | null;

/** The two PostgREST calls `ensureProfile` makes, with canned answers. */
function fakeClient(opts: { existing?: boolean; selectError?: PgError; insertError?: PgError }) {
  const insert = vi.fn(async () => ({ error: opts.insertError ?? null }));
  const maybeSingle = vi.fn(async () => ({
    data: opts.existing ? { id: "user-1" } : null,
    error: opts.selectError ?? null,
  }));
  const client = {
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
      insert,
    })),
  };
  return { client: client as unknown as SupabaseClient, insert };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ensureProfile", () => {
  it("leaves an existing row alone", async () => {
    const { client, insert } = fakeClient({ existing: true });
    expect(await ensureProfile(client, "user-1", "Asia/Jakarta")).toBe("exists");
    expect(insert).not.toHaveBeenCalled();
  });

  it("creates the row with the zone on first sign-in", async () => {
    const { client, insert } = fakeClient({});
    expect(await ensureProfile(client, "user-1", "Asia/Jakarta")).toBe("created");
    expect(insert).toHaveBeenCalledWith({ id: "user-1", time_zone: "Asia/Jakarta" });
  });

  it("skips without a valid zone and writes nothing", async () => {
    const { client, insert } = fakeClient({});
    expect(await ensureProfile(client, "user-1", null)).toBe("skipped");
    expect(insert).not.toHaveBeenCalled();
  });

  it("treats a unique violation (parallel sign-in) as exists", async () => {
    const { client } = fakeClient({ insertError: { code: "23505", message: "duplicate key" } });
    expect(await ensureProfile(client, "user-1", "Asia/Jakarta")).toBe("exists");
  });

  it.each(["23514", "22023"])("treats a zone the database rejects (%s) as skipped", async (code) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { client } = fakeClient({ insertError: { code, message: "bad zone" } });
    expect(await ensureProfile(client, "user-1", "Mars/Olympus")).toBe("skipped");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("auth.profile_zone_rejected_by_db"));
  });

  it("fails on any other insert error", async () => {
    const { client } = fakeClient({ insertError: { code: "42501", message: "permission denied" } });
    expect(await ensureProfile(client, "user-1", "Asia/Jakarta")).toBe("failed");
  });

  it("fails when the lookup fails, without inserting", async () => {
    const { client, insert } = fakeClient({ selectError: { code: "08006", message: "connection" } });
    expect(await ensureProfile(client, "user-1", "Asia/Jakarta")).toBe("failed");
    expect(insert).not.toHaveBeenCalled();
  });
});
