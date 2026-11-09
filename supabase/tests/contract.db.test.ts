import { randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Contract tests for `supabase/migrations` (grants, RLS, indexes, triggers):
 * every migration file as it is, in name order, on a scratch database of a
 * plain Postgres 16 after `supabase-stub.sql`. Runs only with `DATABASE_URL`
 * (a superuser on a local or CI Postgres, never the `dev`/`prod` projects):
 * `npm run test:db`. See `supabase/README.md` › Contract tests.
 */

const DATABASE_URL = process.env.DATABASE_URL;

// `npm run test:db` sets CONTRACT_DB: there a missing DATABASE_URL is an error, not a skip.
if (process.env.CONTRACT_DB && !DATABASE_URL) {
  throw new Error("npm run test:db needs DATABASE_URL (a superuser on a local or CI Postgres 16)");
}
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "migrations");

type Db = pg.ClientBase;

/** `true` when `promise` rejects with this SQLSTATE (and, if given, this constraint). */
async function expectSqlError(promise: Promise<unknown>, code: string, constraint?: string) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e as { code?: string; constraint?: string },
  );
  expect(error, `expected SQLSTATE ${code}`).not.toBeNull();
  expect(error?.code).toBe(code);
  if (constraint) expect(error?.constraint).toBe(constraint);
}

const hash = () => randomBytes(32).toString("hex");

/** A stored Result (only its JSON shape matters to the database). */
const RESULT = { version: 1, score: 100, correctCount: 4, questionCount: 4 };

describe.skipIf(!DATABASE_URL)("supabase migrations contract (Postgres)", () => {
  const dbName = `contract_${randomBytes(6).toString("hex")}`;
  let admin: pg.Client;
  let adminConnected = false;
  let dbConnected = false;
  let db: pg.Client;

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: DATABASE_URL });
    await admin.connect();
    adminConnected = true;
    await admin.query(`create database ${dbName}`);
    const url = new URL(DATABASE_URL!);
    url.pathname = `/${dbName}`;
    db = new pg.Client({ connectionString: url.toString() });
    await db.connect();
    dbConnected = true;
    await db.query(await readFile(path.join(here, "supabase-stub.sql"), "utf8"));
    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      try {
        await db.query(await readFile(path.join(migrationsDir, file), "utf8"));
      } catch (error) {
        throw new Error(`migration ${file} failed: ${(error as Error).message}`);
      }
    }
  }, 60_000);

  afterAll(async () => {
    if (dbConnected) await db.end();
    if (adminConnected) {
      await admin.query(`drop database if exists ${dbName} with (force)`);
      await admin.end();
    }
  });

  /** One request as PostgREST runs it: a transaction under `role`, with the user's JWT claims. */
  async function as<T>(role: "authenticated" | "anon" | "service_role", uid: string | null, fn: (q: Db) => Promise<T>) {
    await db.query("begin");
    try {
      await db.query(`set local role ${role}`);
      await db.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(uid ? { sub: uid, role } : { role }),
      ]);
      const result = await fn(db);
      await db.query("commit");
      return result;
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
  }
  const asUser = <T>(uid: string, fn: (q: Db) => Promise<T>) => as("authenticated", uid, fn);
  const asService = <T>(fn: (q: Db) => Promise<T>) => as("service_role", null, fn);

  /** A signed-in user with a profile (written as the superuser). */
  async function newUser(): Promise<string> {
    const id = randomUUID();
    await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${id}@example.test`]);
    await db.query("insert into public.profiles (id, time_zone) values ($1, 'Asia/Jakarta')", [id]);
    return id;
  }

  /** Start's insert through the user's session. */
  function start(uid: string): Promise<string> {
    return asUser(uid, async (q) => {
      const { rows } = await q.query(
        "insert into public.attempts (item_id, token_sha256, template_version) values ('L01-P1', $1, 1) returning id",
        [hash()],
      );
      return rows[0].id as string;
    });
  }

  async function row(id: string): Promise<{ status: string; user_id: string; received_at: Date | null }> {
    const { rows } = await db.query("select status, user_id, received_at from public.attempts where id = $1", [id]);
    return rows[0];
  }

  /** An attempt of a fresh user in `status`, moved there by the superuser along AD-5. */
  async function attemptIn(status: "open" | "received" | "grading_failed" | "graded" | "abandoned" | "closed") {
    const uid = await newUser();
    const id = await start(uid);
    const steps: Record<typeof status, string[]> = {
      open: [],
      received: ["received"],
      grading_failed: ["received", "grading_failed"],
      graded: ["received", "graded"],
      abandoned: ["abandoned"],
      closed: ["closed"],
    };
    for (const next of steps[status]) {
      // A new `graded` row carries its Result (attempts_graded_has_result).
      const result = next === "graded" ? JSON.stringify(RESULT) : null;
      await db.query("update public.attempts set status = $2, result = $3 where id = $1", [id, next, result]);
    }
    return { uid, id };
  }

  /** The owner's abandon: `update … set status = 'abandoned' where id = ? and status = <from>`. */
  function abandonAs(uid: string, id: string, from: string) {
    return asUser(uid, async (q) =>
      (await q.query("update public.attempts set status = 'abandoned' where id = $1 and status = $2 returning id", [id, from]))
        .rowCount,
    );
  }

  it("applies every migration, the newest last", async () => {
    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
    const { rows } = await db.query("select value from public.app_meta where key = 'schema_version'");
    expect(rows[0].value).toBe(files.at(-1)!.slice(0, 14));
  });

  describe("Start", () => {
    it("inserts with user_id, status and started_at from their defaults", async () => {
      const uid = await newUser();
      const id = await start(uid);
      const r = await row(id);
      expect(r).toMatchObject({ status: "open", user_id: uid, received_at: null });
    });

    it("refuses a second attempt in progress on attempts_one_in_progress_idx", async () => {
      const { uid } = await attemptIn("received");
      await expectSqlError(start(uid), "23505", "attempts_one_in_progress_idx");
    });

    it("allows a new Start after the attempt is graded", async () => {
      const { uid } = await attemptIn("graded");
      await expect(start(uid)).resolves.toMatch(/^[0-9a-f-]{36}$/);
    });

    it("cannot set status, user_id or received_at", async () => {
      const uid = await newUser();
      const other = await newUser();
      for (const [column, value] of [
        ["status", "received"],
        ["user_id", other],
        ["received_at", "2000-01-01T00:00:00Z"],
      ]) {
        await expectSqlError(
          asUser(uid, (q) =>
            q.query(
              `insert into public.attempts (item_id, token_sha256, template_version, ${column}) values ('L01-P1', $1, 1, $2)`,
              [hash(), value],
            ),
          ),
          "42501",
        );
      }
    });
  });

  describe("snapshot (AD-3, AD-9: only the service role writes it, once; the session never touches it)", () => {
    const SNAPSHOT = { contentVersion: 1, scenarioId: "baut-sinar-presisi", seed: 42, questions: [{ number: 1, key: { H2: 10 } }] };

    /** Start's snapshot write: service role, owner and still-null guard in the statement. */
    function setSnapshot(id: string, uid: string, snapshot: unknown = SNAPSHOT) {
      return asService(
        async (q) =>
          (
            await q.query(
              "update public.attempts set snapshot = $3 where id = $1 and user_id = $2 and snapshot is null returning id",
              [id, uid, JSON.stringify(snapshot)],
            )
          ).rowCount,
      );
    }

    it("cannot be inserted by the session", async () => {
      const uid = await newUser();
      await expectSqlError(
        asUser(uid, (q) =>
          q.query(
            "insert into public.attempts (item_id, token_sha256, template_version, snapshot) values ('L01-P1', $1, 1, $2)",
            [hash(), JSON.stringify(SNAPSHOT)],
          ),
        ),
        "42501",
      );
    });

    it("is set once by the service role after the session's Start, and read by it", async () => {
      const uid = await newUser();
      const id = await start(uid);
      expect(await setSnapshot(id, uid)).toBe(1);
      const { rows } = await asService((q) => q.query("select snapshot from public.attempts where id = $1", [id]));
      expect(rows[0].snapshot).toEqual(SNAPSHOT);
    });

    it("matches no row for another user's attempt", async () => {
      const uid = await newUser();
      const other = await newUser();
      const id = await start(uid);
      expect(await setSnapshot(id, other)).toBe(0);
      expect((await db.query("select snapshot from public.attempts where id = $1", [id])).rows[0].snapshot).toBeNull();
    });

    it("cannot be set a second time or changed once set", async () => {
      const uid = await newUser();
      const id = await start(uid);
      expect(await setSnapshot(id, uid)).toBe(1);
      expect(await setSnapshot(id, uid, { contentVersion: 2 })).toBe(0);
      await expectSqlError(
        asService((q) => q.query("update public.attempts set snapshot = '{\"forged\": true}'::jsonb where id = $1", [id])),
        "23514",
      );
      await expectSqlError(
        asService((q) => q.query("update public.attempts set snapshot = null where id = $1", [id])),
        "23514",
      );
      const { rows } = await db.query("select snapshot from public.attempts where id = $1", [id]);
      expect(rows[0].snapshot).toEqual(SNAPSHOT);
    });

    it("stays null for an attempt without one (tracer rows)", async () => {
      const uid = await newUser();
      const id = await start(uid);
      const { rows } = await db.query("select snapshot from public.attempts where id = $1", [id]);
      expect(rows[0].snapshot).toBeNull();
    });

    it("refuses a snapshot that is not a JSON object", async () => {
      const uid = await newUser();
      const id = await start(uid);
      await expectSqlError(setSnapshot(id, uid, [1, 2]), "23514");
      await expectSqlError(setSnapshot(id, uid, "key"), "23514");
    });

    it("cannot be read or updated by the owner, while the other columns stay readable", async () => {
      const uid = await newUser();
      const id = await start(uid);
      expect(await setSnapshot(id, uid)).toBe(1);
      await expectSqlError(asUser(uid, (q) => q.query("select snapshot from public.attempts where id = $1", [id])), "42501");
      await expectSqlError(asUser(uid, (q) => q.query("select * from public.attempts where id = $1", [id])), "42501");
      await expectSqlError(
        asUser(uid, (q) => q.query("update public.attempts set snapshot = '{}'::jsonb where id = $1", [id])),
        "42501",
      );
      const { rows } = await asUser(uid, (q) =>
        q.query(
          "select id, user_id, item_id, token_sha256, template_version, status, started_at, received_at from public.attempts where id = $1",
          [id],
        ),
      );
      expect(rows).toHaveLength(1);
      // Abandon (status only) and Start's compensation (delete while open) still work.
      expect(await abandonAs(uid, id, "open")).toBe(1);
      const fresh = await start(uid);
      const deleted = await asUser(uid, async (q) =>
        (await q.query("delete from public.attempts where id = $1 returning id", [fresh])).rowCount,
      );
      expect(deleted).toBe(1);
    });
  });

  describe("result (AD-3, AD-9: written once by the service role with graded; the owner only reads it)", () => {
    /** Grading's compare-and-set: `received` → `graded` with the Result, in one UPDATE (service role). */
    function writeResult(id: string, result: unknown = RESULT) {
      return asService(
        async (q) =>
          (
            await q.query(
              "update public.attempts set status = 'graded', result = $2 where id = $1 and status = 'received' returning id",
              [id, JSON.stringify(result)],
            )
          ).rowCount,
      );
    }

    it("is written by the service role's compare-and-set from received, together with graded", async () => {
      const { id } = await attemptIn("received");
      expect(await writeResult(id)).toBe(1);
      const { rows } = await db.query("select status, result from public.attempts where id = $1", [id]);
      expect(rows[0]).toEqual({ status: "graded", result: RESULT });
    });

    it("is read by the owner through the session, and by no one else", async () => {
      const { uid, id } = await attemptIn("received");
      expect(await writeResult(id)).toBe(1);
      const own = await asUser(uid, (q) => q.query("select status, result from public.attempts where id = $1", [id]));
      expect(own.rows).toEqual([{ status: "graded", result: RESULT }]);
      const stranger = await newUser();
      const seen = await asUser(stranger, (q) => q.query("select result from public.attempts where id = $1", [id]));
      expect(seen.rowCount).toBe(0);
      await expectSqlError(as("anon", null, (q) => q.query("select result from public.attempts")), "42501");
    });

    it("cannot be written by the session (42501), neither on update nor on insert", async () => {
      const { uid, id } = await attemptIn("received");
      await expectSqlError(
        asUser(uid, (q) => q.query("update public.attempts set result = $2 where id = $1", [id, JSON.stringify(RESULT)])),
        "42501",
      );
      await expectSqlError(
        asUser(uid, (q) =>
          q.query(
            "update public.attempts set status = 'abandoned', result = $2 where id = $1 and status = 'received'",
            [id, JSON.stringify(RESULT)],
          ),
        ),
        "42501",
      );
      const other = await newUser();
      await expectSqlError(
        asUser(other, (q) =>
          q.query(
            "insert into public.attempts (item_id, token_sha256, template_version, result) values ('L01-P1', $1, 1, $2)",
            [hash(), JSON.stringify(RESULT)],
          ),
        ),
        "42501",
      );
      expect((await db.query("select result from public.attempts where id = $1", [id])).rows[0].result).toBeNull();
    });

    it("cannot be written a second time or changed once set", async () => {
      const { id } = await attemptIn("received");
      expect(await writeResult(id)).toBe(1);
      // The compare-and-set no longer matches: the attempt is graded.
      expect(await writeResult(id, { ...RESULT, score: 0 })).toBe(0);
      await expectSqlError(
        asService((q) => q.query("update public.attempts set result = '{\"score\": 0}'::jsonb where id = $1", [id])),
        "23514",
      );
      await expectSqlError(asService((q) => q.query("update public.attempts set result = null where id = $1", [id])), "23514");
      expect((await db.query("select result from public.attempts where id = $1", [id])).rows[0].result).toEqual(RESULT);
    });

    it("exists only on a graded attempt, and every new graded attempt has one", async () => {
      const { id } = await attemptIn("received");
      await expectSqlError(
        asService((q) => q.query("update public.attempts set result = $2 where id = $1", [id, JSON.stringify(RESULT)])),
        "23514",
        "attempts_result_only_when_graded",
      );
      await expectSqlError(
        asService((q) => q.query("update public.attempts set status = 'graded' where id = $1 and status = 'received'", [id])),
        "23514",
        "attempts_graded_has_result",
      );
      const failed = await asService(
        async (q) =>
          (await q.query("update public.attempts set status = 'grading_failed' where id = $1 and status = 'received' returning id", [id]))
            .rowCount,
      );
      expect(failed).toBe(1);
    });

    it("refuses a Result that is not a JSON object", async () => {
      const { id } = await attemptIn("received");
      await expectSqlError(writeResult(id, [1, 2]), "23514");
    });
  });

  describe("received_at", () => {
    it("is stamped by the trigger when the macro path moves open to received", async () => {
      const uid = await newUser();
      const id = await start(uid);
      const count = await asService(
        async (q) =>
          (await q.query("update public.attempts set status = 'received' where id = $1 and status = 'open' returning id", [id]))
            .rowCount,
      );
      expect(count).toBe(1);
      const r = await row(id);
      expect(r.status).toBe("received");
      expect(r.received_at).toBeInstanceOf(Date);
      expect(Math.abs(r.received_at!.getTime() - Date.now())).toBeLessThan(60_000);
    });

    it("ignores a value sent with the status change", async () => {
      const uid = await newUser();
      const id = await start(uid);
      await db.query("update public.attempts set status = 'received', received_at = '2000-01-01T00:00:00Z' where id = $1", [id]);
      expect((await row(id)).received_at!.getUTCFullYear()).not.toBe(2000);
    });

    it("keeps the first value when the service role moves grading_failed back to received", async () => {
      const { id } = await attemptIn("grading_failed");
      // A fixed earlier value (no status change, so the trigger does not fire).
      await db.query("update public.attempts set received_at = '2001-01-01T00:00:00Z' where id = $1", [id]);
      const count = await asService(
        async (q) =>
          (
            await q.query(
              "update public.attempts set status = 'received' where id = $1 and status = 'grading_failed' returning id",
              [id],
            )
          ).rowCount,
      );
      expect(count).toBe(1);
      const r = await row(id);
      expect(r.status).toBe("received");
      expect(r.received_at!.toISOString()).toBe("2001-01-01T00:00:00.000Z");
    });

    it("cannot be written by the service role or the owner", async () => {
      const { uid, id } = await attemptIn("received");
      await expectSqlError(
        asService((q) => q.query("update public.attempts set received_at = now() where id = $1", [id])),
        "42501",
      );
      await expectSqlError(
        asUser(uid, (q) => q.query("update public.attempts set received_at = now() where id = $1", [id])),
        "42501",
      );
    });
  });

  describe("owner-only access", () => {
    it("hides other users' attempts and profiles", async () => {
      const { id } = await attemptIn("open");
      const stranger = await newUser();
      const seen = await asUser(stranger, async (q) => ({
        attempts: (await q.query("select id from public.attempts where id = $1", [id])).rowCount,
        all: (await q.query("select user_id from public.attempts")).rows,
        profiles: (await q.query("select id from public.profiles")).rows,
      }));
      expect(seen.attempts).toBe(0);
      expect(seen.all).toEqual([]);
      expect(seen.profiles).toEqual([{ id: stranger }]);
    });
  });

  describe("delete", () => {
    it("deletes the owner's attempt only while it is open", async () => {
      const open = await attemptIn("open");
      const received = await attemptIn("received");
      const stranger = await newUser();
      const del = (uid: string, id: string) =>
        asUser(uid, async (q) => (await q.query("delete from public.attempts where id = $1 returning id", [id])).rowCount);
      expect(await del(stranger, open.id)).toBe(0);
      expect(await del(received.uid, received.id)).toBe(0);
      expect(await row(received.id)).toBeDefined();
      expect(await del(open.uid, open.id)).toBe(1);
      expect(await row(open.id)).toBeUndefined();
    });
  });

  describe("abandon (session + RLS)", () => {
    it.each(["open", "received", "grading_failed"] as const)("moves the owner's %s attempt to abandoned", async (status) => {
      const { uid, id } = await attemptIn(status);
      const before = (await row(id)).received_at;
      expect(await abandonAs(uid, id, status)).toBe(1);
      const after = await row(id);
      expect(after.status).toBe("abandoned");
      expect(after.received_at?.getTime() ?? null).toBe(before?.getTime() ?? null);
      // No attempt is in progress any more: the next Start is allowed.
      await expect(start(uid)).resolves.toMatch(/^[0-9a-f-]{36}$/);
    });

    it.each(["graded", "abandoned", "closed"] as const)("matches no row in %s", async (status) => {
      const { uid, id } = await attemptIn(status);
      expect(await abandonAs(uid, id, status)).toBe(0);
      expect((await row(id)).status).toBe(status);
    });

    it.each(["received", "graded", "grading_failed", "closed", "open"])(
      "refuses the owner moving an open attempt to %s",
      async (to) => {
        const { uid, id } = await attemptIn("open");
        await expectSqlError(
          asUser(uid, (q) => q.query("update public.attempts set status = $2 where id = $1", [id, to])),
          "42501",
        );
        expect((await row(id)).status).toBe("open");
      },
    );

    it("refuses the owner moving a grading_failed attempt back to received", async () => {
      const { uid, id } = await attemptIn("grading_failed");
      await expectSqlError(
        asUser(uid, (q) => q.query("update public.attempts set status = 'received' where id = $1", [id])),
        "42501",
      );
    });

    it("matches no row of another user", async () => {
      const { id } = await attemptIn("open");
      const stranger = await newUser();
      expect(await abandonAs(stranger, id, "open")).toBe(0);
      expect((await row(id)).status).toBe("open");
    });

    it("cannot update any other column", async () => {
      const { uid, id } = await attemptIn("open");
      await expectSqlError(
        asUser(uid, (q) => q.query("update public.attempts set item_id = 'L01-P2' where id = $1", [id])),
        "42501",
      );
    });
  });

  describe("upload: the session has no write access (AD-9: the route uses the service role)", () => {
    it.each(["open", "grading_failed"] as const)("refuses the owner moving a %s attempt to received", async (from) => {
      const { uid, id } = await attemptIn(from);
      await expectSqlError(
        asUser(uid, (q) =>
          q.query("update public.attempts set status = 'received' where id = $1 and status = $2", [id, from]),
        ),
        "42501",
      );
      expect((await row(id)).status).toBe(from);
    });

    it("refuses the owner writing submission-1.xlsm, also while the attempt is open", async () => {
      const { uid, id } = await attemptIn("open");
      const name = `${id}/submission-1.xlsm`;
      await expectSqlError(
        asUser(uid, (q) =>
          q.query("insert into storage.objects (bucket_id, name, owner) values ('attempt-files', $1, $2)", [name, uid]),
        ),
        "42501",
      );
      // An object written by the service role cannot be overwritten by the owner either.
      await asService((q) =>
        q.query("insert into storage.objects (bucket_id, name, owner) values ('attempt-files', $1, null)", [name]),
      );
      const updated = await asUser(uid, async (q) =>
        (await q.query("update storage.objects set owner = $2 where bucket_id = 'attempt-files' and name = $1", [name, uid]))
          .rowCount,
      );
      expect(updated).toBe(0);
    });
  });

  describe("anon", () => {
    it("has no access to attempts or profiles", async () => {
      await expectSqlError(as("anon", null, (q) => q.query("select id from public.attempts")), "42501");
      await expectSqlError(as("anon", null, (q) => q.query("select id from public.profiles")), "42501");
      await expectSqlError(
        as("anon", null, (q) =>
          q.query("insert into public.attempts (item_id, token_sha256, template_version) values ('L01-P1', $1, 1)", [hash()]),
        ),
        "42501",
      );
      await expectSqlError(as("anon", null, (q) => q.query("update public.attempts set status = 'abandoned'")), "42501");
      await expectSqlError(as("anon", null, (q) => q.query("delete from public.attempts")), "42501");
    });

    it("reads app_meta only", async () => {
      const { rows } = await as("anon", null, (q) => q.query("select value from public.app_meta where key = 'schema_version'"));
      expect(rows).toHaveLength(1);
      await expectSqlError(as("anon", null, (q) => q.query("update public.app_meta set value = 'x'")), "42501");
    });
  });
});
