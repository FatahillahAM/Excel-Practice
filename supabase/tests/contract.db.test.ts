import { randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ATTEMPT_EVENTS, ATTEMPT_STATUSES, transition } from "../../src/core/services/attempts/lifecycle";

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
  /** The scratch database's URL, for the second and third clients of the concurrency cases. */
  let scratchUrl: string;

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: DATABASE_URL });
    await admin.connect();
    adminConnected = true;
    await admin.query(`create database ${dbName}`);
    const url = new URL(DATABASE_URL!);
    url.pathname = `/${dbName}`;
    scratchUrl = url.toString();
    db = new pg.Client({ connectionString: scratchUrl });
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

  /**
   * An attempt of a fresh user in `status`, moved there by the superuser along
   * AD-5; with `snapshot`, Start's service-role snapshot write first (once, while `open`).
   */
  async function attemptIn(
    status: "open" | "received" | "grading_failed" | "graded" | "abandoned" | "closed",
    snapshot?: unknown,
  ) {
    const uid = await newUser();
    const id = await start(uid);
    if (snapshot !== undefined) {
      await asService((q) =>
        q.query("update public.attempts set snapshot = $3 where id = $1 and user_id = $2 and snapshot is null", [
          id,
          uid,
          JSON.stringify(snapshot),
        ]),
      );
    }
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

    it("exists only on a graded (or later closed) attempt, and every new graded attempt has one", async () => {
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

    it("stays on its graded attempt, which can no longer move to closed (outside AD-5, migration 20261110000001)", async () => {
      const { id } = await attemptIn("received");
      expect(await writeResult(id)).toBe(1);
      await expectSqlError(
        db.query("update public.attempts set status = 'closed' where id = $1", [id]),
        "23514",
        "attempts_status_ad5",
      );
      const { rows } = await db.query("select status, result from public.attempts where id = $1", [id]);
      expect(rows[0]).toEqual({ status: "graded", result: RESULT });
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

  describe("status fence (AD-5, every role)", () => {
    const STATUSES = ATTEMPT_STATUSES;
    /** The edges of the AD-5 diagram, from the one state machine (`transition()`), over every status × event. */
    const EDGES = new Set(
      ATTEMPT_STATUSES.flatMap((from) =>
        ATTEMPT_EVENTS.flatMap((event) => {
          const next = transition(from, event);
          return next.ok ? [`${from}>${next.to}`] : [];
        }),
      ),
    );
    const PAIRS = STATUSES.flatMap((from) => STATUSES.filter((to) => to !== from).map((to) => [from, to] as const));

    it("covers all 30 from → to pairs, 8 of them edges", () => {
      expect(PAIRS).toHaveLength(30);
      expect(PAIRS.filter(([from, to]) => EDGES.has(`${from}>${to}`))).toHaveLength(8);
    });

    it.each(PAIRS)("service role: %s → %s follows the diagram", async (from, to) => {
      const { id } = await attemptIn(from);
      // A new `graded` row carries its Result; no other target sends one.
      const update =
        to === "graded"
          ? asService((q) =>
              q.query("update public.attempts set status = $2, result = $3 where id = $1", [id, to, JSON.stringify(RESULT)]),
            )
          : asService((q) => q.query("update public.attempts set status = $2 where id = $1", [id, to]));
      if (EDGES.has(`${from}>${to}`)) {
        await update;
        expect((await row(id)).status).toBe(to);
      } else {
        await expectSqlError(update, "23514", "attempts_status_ad5");
        expect((await row(id)).status).toBe(from);
      }
    });

    it.each([
      ["graded", "open"],
      ["abandoned", "received"],
    ] as const)("superuser: refuses %s → %s", async (from, to) => {
      const { id } = await attemptIn(from);
      await expectSqlError(
        db.query("update public.attempts set status = $2 where id = $1", [id, to]),
        "23514",
        "attempts_status_ad5",
      );
      expect((await row(id)).status).toBe(from);
    });

    it("superuser: refuses an insert in any status but open", async () => {
      const uid = await newUser();
      await expectSqlError(
        db.query(
          "insert into public.attempts (user_id, item_id, token_sha256, template_version, status, received_at, result) values ($1, 'L01-P1', $2, 1, 'graded', now(), $3)",
          [uid, hash(), JSON.stringify(RESULT)],
        ),
        "23514",
        "attempts_status_ad5",
      );
      const { rows } = await db.query("select count(*)::int as n from public.attempts where user_id = $1", [uid]);
      expect(rows[0].n).toBe(0);
    });

    it("allows an update that leaves the status as it is", async () => {
      const { id } = await attemptIn("graded");
      const count = await asService(
        async (q) => (await q.query("update public.attempts set status = 'graded' where id = $1 returning id", [id])).rowCount,
      );
      expect(count).toBe(1);
      await db.query("update public.attempts set status = 'graded' where id = $1", [id]);
      expect((await row(id)).status).toBe("graded");
    });
  });

  describe("grading_requested_at (U4: the database's time of the current grading request)", () => {
    async function stamps(id: string) {
      const { rows } = await db.query("select received_at, grading_requested_at from public.attempts where id = $1", [id]);
      return rows[0] as { received_at: Date | null; grading_requested_at: Date | null };
    }

    it("is stamped when the service role moves open to received", async () => {
      const uid = await newUser();
      const id = await start(uid);
      expect((await stamps(id)).grading_requested_at).toBeNull();
      await asService((q) => q.query("update public.attempts set status = 'received' where id = $1 and status = 'open'", [id]));
      const s = await stamps(id);
      expect(s.grading_requested_at).toBeInstanceOf(Date);
      expect(s.grading_requested_at!.getTime()).toBe(s.received_at!.getTime());
    });

    it("is stamped again on grading_failed → received, while received_at keeps the first file's time", async () => {
      const { id } = await attemptIn("grading_failed");
      await db.query(
        "update public.attempts set received_at = '2001-01-01T00:00:00Z', grading_requested_at = '2001-01-01T00:00:00Z' where id = $1",
        [id],
      );
      await asService((q) =>
        q.query("update public.attempts set status = 'received' where id = $1 and status = 'grading_failed'", [id]),
      );
      const s = await stamps(id);
      expect(s.received_at!.toISOString()).toBe("2001-01-01T00:00:00.000Z");
      expect(Math.abs(s.grading_requested_at!.getTime() - Date.now())).toBeLessThan(60_000);
    });

    it("keeps its value on other status changes and ignores a value sent with one", async () => {
      const { id } = await attemptIn("received");
      await db.query("update public.attempts set grading_requested_at = '2002-01-01T00:00:00Z' where id = $1", [id]);
      await db.query(
        "update public.attempts set status = 'grading_failed', grading_requested_at = '2003-01-01T00:00:00Z' where id = $1",
        [id],
      );
      expect((await stamps(id)).grading_requested_at!.toISOString()).toBe("2002-01-01T00:00:00.000Z");
    });

    it("is read by the owner, and written by neither the session nor the service role (42501)", async () => {
      const { uid, id } = await attemptIn("received");
      const own = await asUser(uid, (q) => q.query("select grading_requested_at from public.attempts where id = $1", [id]));
      expect(own.rows[0].grading_requested_at).toBeInstanceOf(Date);
      await expectSqlError(
        asUser(uid, (q) => q.query("update public.attempts set grading_requested_at = now() where id = $1", [id])),
        "42501",
      );
      await expectSqlError(
        asService((q) => q.query("update public.attempts set grading_requested_at = now() where id = $1", [id])),
        "42501",
      );
    });
  });

  describe("claim_grading_restart (U4: at most one restart per attempt per 15 s)", () => {
    const claim = (id: string) =>
      asService(async (q) => (await q.query("select public.claim_grading_restart($1) as won", [id])).rows[0].won as boolean);
    const backdate = (id: string) =>
      db.query("update public.attempts set grading_requested_at = now() - interval '20 seconds' where id = $1", [id]);

    it("is false under 15 s, true once after 15 s, then false on the immediate second call", async () => {
      const { id } = await attemptIn("received");
      expect(await claim(id)).toBe(false);
      await backdate(id);
      expect(await claim(id)).toBe(true);
      const { rows } = await db.query("select grading_requested_at from public.attempts where id = $1", [id]);
      expect(Math.abs((rows[0].grading_requested_at as Date).getTime() - Date.now())).toBeLessThan(60_000);
      expect(await claim(id)).toBe(false);
      expect((await row(id)).status).toBe("received");
    });

    it.each(["open", "grading_failed", "graded", "abandoned", "closed"] as const)("is false for a %s attempt", async (status) => {
      const { id } = await attemptIn(status);
      await backdate(id);
      expect(await claim(id)).toBe(false);
    });

    it("is false for an attempt that does not exist", async () => {
      expect(await claim(randomUUID())).toBe(false);
    });

    it("is not executable by the session or anon", async () => {
      const { uid, id } = await attemptIn("received");
      await backdate(id);
      await expectSqlError(asUser(uid, (q) => q.query("select public.claim_grading_restart($1)", [id])), "42501");
      await expectSqlError(as("anon", null, (q) => q.query("select public.claim_grading_restart($1)", [id])), "42501");
      expect(await claim(id)).toBe(true);
    });

    it("falls back to received_at for a row without grading_requested_at", async () => {
      const { id } = await attemptIn("received");
      await db.query(
        "update public.attempts set grading_requested_at = null, received_at = now() - interval '20 seconds' where id = $1",
        [id],
      );
      expect(await claim(id)).toBe(true);
    });

    it("counts restarts and refuses the fourth (cap 3); Try again resets the count", async () => {
      const { id } = await attemptIn("received");
      const restarts = async () =>
        (await db.query("select grading_restarts from public.attempts where id = $1", [id])).rows[0].grading_restarts as number;
      expect(await restarts()).toBe(0);
      for (let n = 1; n <= 3; n++) {
        await backdate(id);
        expect(await claim(id)).toBe(true);
        expect(await restarts()).toBe(n);
      }
      await backdate(id);
      expect(await claim(id)).toBe(false);
      expect(await restarts()).toBe(3);

      // The status endpoint escalates; Try again (service role) starts the count over in the same UPDATE.
      await asService((q) => q.query("update public.attempts set status = 'grading_failed' where id = $1 and status = 'received'", [id]));
      expect(await restarts()).toBe(3);
      await asService((q) => q.query("update public.attempts set status = 'received' where id = $1 and status = 'grading_failed'", [id]));
      expect(await restarts()).toBe(0);
      await backdate(id);
      expect(await claim(id)).toBe(true);
    });

    it("grading_restarts is read by the owner, and written by neither the session nor the service role (42501)", async () => {
      const { uid, id } = await attemptIn("received");
      const own = await asUser(uid, (q) => q.query("select grading_restarts from public.attempts where id = $1", [id]));
      expect(own.rows[0].grading_restarts).toBe(0);
      await expectSqlError(
        asUser(uid, (q) => q.query("update public.attempts set grading_restarts = 0 where id = $1", [id])),
        "42501",
      );
      await expectSqlError(
        asService((q) => q.query("update public.attempts set grading_restarts = 0 where id = $1", [id])),
        "42501",
      );
    });

    it("a status change ignores a grading_restarts value sent with it", async () => {
      const { id } = await attemptIn("received");
      await db.query("update public.attempts set grading_restarts = 2 where id = $1", [id]);
      await db.query("update public.attempts set status = 'grading_failed', grading_restarts = 0 where id = $1", [id]);
      const { rows } = await db.query("select grading_restarts from public.attempts where id = $1", [id]);
      expect(rows[0].grading_restarts).toBe(2);
    });
  });

  describe("grading-run identity (a superseded run cannot overwrite a newer one)", () => {
    /** The stamp as the adapter sees it through PostgREST: text, with microseconds. */
    const stamp = async (id: string) =>
      (await db.query("select grading_requested_at::text as s from public.attempts where id = $1", [id])).rows[0].s as string;
    /** The grader's final compare-and-set: status and the stamp it loaded at run start. */
    const complete = (id: string, loaded: string) =>
      asService(
        async (q) =>
          (
            await q.query(
              "update public.attempts set status = 'graded', result = $3 where id = $1 and status = 'received' and grading_requested_at = $2 returning id",
              [id, loaded, JSON.stringify(RESULT)],
            )
          ).rowCount,
      );

    it("a run started before a U4 restart is lost; the restarted run writes", async () => {
      const { id } = await attemptIn("received");
      await db.query("update public.attempts set grading_requested_at = now() - interval '20 seconds' where id = $1", [id]);
      const stale = await stamp(id);
      const claimed = await asService(
        async (q) => (await q.query("select public.claim_grading_restart($1) as won", [id])).rows[0].won as boolean,
      );
      expect(claimed).toBe(true);
      expect(await complete(id, stale)).toBe(0);
      expect((await row(id)).status).toBe("received");
      expect(await complete(id, await stamp(id))).toBe(1);
      expect((await row(id)).status).toBe("graded");
    });

    it("a run started before grading failed and Try again is lost", async () => {
      const { id } = await attemptIn("received");
      await db.query("update public.attempts set grading_requested_at = now() - interval '20 seconds' where id = $1", [id]);
      const stale = await stamp(id);
      await asService((q) => q.query("update public.attempts set status = 'grading_failed' where id = $1", [id]));
      await asService((q) => q.query("update public.attempts set status = 'received' where id = $1", [id]));
      expect(await complete(id, stale)).toBe(0);
      const { rows } = await db.query("select status, result from public.attempts where id = $1", [id]);
      expect(rows[0]).toEqual({ status: "received", result: null });
    });
  });

  describe("lost (Abandon wins the race with grading)", () => {
    it("leaves the grader's compare-and-set with no row and the Result unwritten", async () => {
      const { uid, id } = await attemptIn("received");
      expect(await abandonAs(uid, id, "received")).toBe(1);
      const graded = await asService(
        async (q) =>
          (
            await q.query(
              "update public.attempts set status = 'graded', result = $2 where id = $1 and status = 'received' returning id",
              [id, JSON.stringify(RESULT)],
            )
          ).rowCount,
      );
      expect(graded).toBe(0);
      const { rows } = await db.query("select status, result from public.attempts where id = $1", [id]);
      expect(rows[0]).toEqual({ status: "abandoned", result: null });
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

    it.each(["received", "closed", "open"])(
      "refuses the owner moving an open attempt to %s (RLS, 42501)",
      async (to) => {
        const { uid, id } = await attemptIn("open");
        await expectSqlError(
          asUser(uid, (q) => q.query("update public.attempts set status = $2 where id = $1", [id, to])),
          "42501",
        );
        expect((await row(id)).status).toBe("open");
      },
    );

    // Outside AD-5: the fence (a BEFORE trigger) refuses before RLS `with check`.
    it.each(["graded", "grading_failed"])(
      "refuses the owner moving an open attempt to %s (fence, 23514)",
      async (to) => {
        const { uid, id } = await attemptIn("open");
        await expectSqlError(
          asUser(uid, (q) => q.query("update public.attempts set status = $2 where id = $1", [id, to])),
          "23514",
          "attempts_status_ad5",
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

  describe("hint_reveals + reveal_hint (B5, AD-5, AD-9)", () => {
    const hintsOf = (n: number, count: number) => Array.from({ length: count }, (_, i) => `Hint ${i + 1} soal ${n}.`);
    /** A v2-like snapshot: quota 3, questions 1–4 with 3 hints each, question 5 with 1 hint. */
    const HINT_SNAPSHOT = {
      version: 2,
      contentVersion: 1,
      scenarioId: "baut-sinar-presisi",
      seed: 42,
      hintQuota: 3,
      questions: [
        ...[1, 2, 3, 4].map((n) => ({ number: n, points: 20, hints: hintsOf(n, 3) })),
        { number: 5, points: 20, hints: hintsOf(5, 1) },
      ],
    };
    type Answer = { code: string; question: number; hintIndex: number; hint: string | null; used: number; quota: number };

    const reveal = (id: string, question: number, index: number) =>
      asService(
        async (q) =>
          (await q.query("select public.reveal_hint($1, $2, $3) as a", [id, question, index])).rows[0].a as Answer,
      );
    const count = async (id: string) =>
      (await db.query("select count(*)::int as n from public.hint_reveals where attempt_id = $1", [id])).rows[0].n as number;
    const insertAsSuper = (id: string, question: number, index: number) =>
      db.query("insert into public.hint_reveals (attempt_id, question_number, hint_index) values ($1, $2, $3)", [
        id,
        question,
        index,
      ]);

    it("reveals up to the quota with the snapshot's text, then answers quota_used with no new row", async () => {
      const { id } = await attemptIn("open", HINT_SNAPSHOT);
      expect(await reveal(id, 2, 0)).toEqual({
        code: "revealed",
        question: 2,
        hintIndex: 0,
        hint: "Hint 1 soal 2.",
        used: 1,
        quota: 3,
      });
      expect(await reveal(id, 2, 1)).toMatchObject({ code: "revealed", hint: "Hint 2 soal 2.", used: 2 });
      expect(await reveal(id, 1, 0)).toMatchObject({ code: "revealed", hint: "Hint 1 soal 1.", used: 3 });
      expect(await reveal(id, 3, 0)).toMatchObject({ code: "quota_used", hint: null, used: 3, quota: 3 });
      expect(await count(id)).toBe(3);
    });

    it("answers the same index twice with already and the same text, writing one row", async () => {
      const { id } = await attemptIn("open", HINT_SNAPSHOT);
      expect(await reveal(id, 3, 0)).toMatchObject({ code: "revealed", used: 1 });
      expect(await reveal(id, 3, 0)).toMatchObject({ code: "already", hint: "Hint 1 soal 3.", used: 1 });
      expect(await count(id)).toBe(1);
    });

    it("refuses an index past the next one (out_of_order) and a negative one", async () => {
      const { id } = await attemptIn("open", HINT_SNAPSHOT);
      expect(await reveal(id, 1, 1)).toMatchObject({ code: "out_of_order", hint: null, used: 0 });
      expect(await reveal(id, 1, -1)).toMatchObject({ code: "out_of_order" });
      expect(await count(id)).toBe(0);
    });

    it("answers no_more_hints once the question's hints are all shown, while quota is left", async () => {
      const { id } = await attemptIn("open", HINT_SNAPSHOT);
      expect(await reveal(id, 5, 0)).toMatchObject({ code: "revealed", used: 1 });
      expect(await reveal(id, 5, 1)).toMatchObject({ code: "no_more_hints", hint: null, used: 1, quota: 3 });
      expect(await count(id)).toBe(1);
    });

    it("answers no_question, not_found and snapshot_invalid without a row", async () => {
      const { id } = await attemptIn("open", HINT_SNAPSHOT);
      expect(await reveal(id, 9, 0)).toMatchObject({ code: "no_question" });
      expect(await reveal(randomUUID(), 1, 0)).toMatchObject({ code: "not_found" });
      const bare = await attemptIn("open");
      expect(await reveal(bare.id, 1, 0)).toMatchObject({ code: "snapshot_invalid" });
      const noQuota = await attemptIn("open", { ...HINT_SNAPSHOT, hintQuota: "3" });
      expect(await reveal(noQuota.id, 1, 0)).toMatchObject({ code: "snapshot_invalid" });
      expect(await count(id)).toBe(0);
      expect(await count(bare.id)).toBe(0);
    });

    it.each(["received", "grading_failed", "graded", "abandoned", "closed"] as const)(
      "answers not_open for a %s attempt",
      async (status) => {
        const { id } = await attemptIn(status, HINT_SNAPSHOT);
        expect(await reveal(id, 1, 0)).toMatchObject({ code: "not_open", hint: null });
        expect(await count(id)).toBe(0);
      },
    );

    it("is not executable by the session or anon (42501)", async () => {
      const { uid, id } = await attemptIn("open", HINT_SNAPSHOT);
      await expectSqlError(asUser(uid, (q) => q.query("select public.reveal_hint($1, 1, 0)", [id])), "42501");
      await expectSqlError(as("anon", null, (q) => q.query("select public.reveal_hint($1, 1, 0)", [id])), "42501");
      expect(await count(id)).toBe(0);
    });

    it("refuses direct insert, update and delete by the session and the service role (42501)", async () => {
      const { uid, id } = await attemptIn("open", HINT_SNAPSHOT);
      expect(await reveal(id, 1, 0)).toMatchObject({ code: "revealed" });
      const statements = [
        ["insert into public.hint_reveals (attempt_id, question_number, hint_index) values ($1, 2, 0)", [id]],
        ["update public.hint_reveals set hint_index = 1 where attempt_id = $1", [id]],
        ["delete from public.hint_reveals where attempt_id = $1", [id]],
      ] as const;
      for (const [sql, params] of statements) {
        await expectSqlError(asUser(uid, (q) => q.query(sql, [...params])), "42501");
        await expectSqlError(asService((q) => q.query(sql, [...params])), "42501");
        await expectSqlError(as("anon", null, (q) => q.query(sql, [...params])), "42501");
      }
      expect(await count(id)).toBe(1);
    });

    it("superuser: refuses an insert for an attempt that is not open (hint_reveals_open_only)", async () => {
      const { id } = await attemptIn("received", HINT_SNAPSHOT);
      await expectSqlError(insertAsSuper(id, 1, 0), "23514", "hint_reveals_open_only");
      expect(await count(id)).toBe(0);
    });

    it("superuser: refuses the row past the quota (hint_reveals_quota), and a duplicate (23505)", async () => {
      const { id } = await attemptIn("open", HINT_SNAPSHOT);
      await insertAsSuper(id, 1, 0);
      await expectSqlError(insertAsSuper(id, 1, 0), "23505");
      await insertAsSuper(id, 1, 1);
      await insertAsSuper(id, 2, 0);
      await expectSqlError(insertAsSuper(id, 3, 0), "23514", "hint_reveals_quota");
      expect(await count(id)).toBe(3);
      const bare = await attemptIn("open");
      await expectSqlError(insertAsSuper(bare.id, 1, 0), "23514", "hint_reveals_quota");
    });

    it("is read by the owner only; anon has no access", async () => {
      const { uid, id } = await attemptIn("open", HINT_SNAPSHOT);
      await reveal(id, 4, 0);
      const own = await asUser(uid, (q) =>
        q.query("select question_number, hint_index from public.hint_reveals where attempt_id = $1", [id]),
      );
      expect(own.rows).toEqual([{ question_number: 4, hint_index: 0 }]);
      const stranger = await newUser();
      const seen = await asUser(stranger, (q) => q.query("select * from public.hint_reveals"));
      expect(seen.rowCount).toBe(0);
      await expectSqlError(as("anon", null, (q) => q.query("select * from public.hint_reveals")), "42501");
    });

    it("goes with its attempt when the attempt is deleted (the owner's Start compensation)", async () => {
      const { uid, id } = await attemptIn("open", HINT_SNAPSHOT);
      await reveal(id, 1, 0);
      const deleted = await asUser(uid, async (q) =>
        (await q.query("delete from public.attempts where id = $1 returning id", [id])).rowCount,
      );
      expect(deleted).toBe(1);
      expect(await count(id)).toBe(0);
    });

    describe("concurrency (the attempt row lock)", () => {
      const clients: pg.Client[] = [];
      async function client(): Promise<pg.Client> {
        const c = new pg.Client({ connectionString: scratchUrl });
        await c.connect();
        clients.push(c);
        return c;
      }
      afterAll(async () => {
        await Promise.all(clients.map((c) => c.end()));
      });

      /** Waits until some backend of the scratch database waits on a lock. */
      async function lockWaiter(): Promise<void> {
        for (let i = 0; i < 200; i++) {
          const { rows } = await db.query(
            "select count(*)::int as n from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'",
          );
          if (rows[0].n > 0) return;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        throw new Error("no backend waited on the lock");
      }
      const revealIn = async (c: pg.Client, id: string, question: number, index: number) =>
        (await c.query("select public.reveal_hint($1, $2, $3) as a", [id, question, index])).rows[0].a as Answer;

      it("two reveals for different questions at used = 2: one revealed, the other quota_used", async () => {
        const { id } = await attemptIn("open", HINT_SNAPSHOT);
        await reveal(id, 1, 0);
        await reveal(id, 1, 1);
        const [a, b] = [await client(), await client()];
        await a.query("begin");
        await a.query("set local role service_role");
        await b.query("begin");
        await b.query("set local role service_role");
        expect(await revealIn(a, id, 2, 0)).toMatchObject({ code: "revealed", used: 3 });
        const blocked = revealIn(b, id, 3, 0);
        await lockWaiter();
        await a.query("commit");
        expect(await blocked).toMatchObject({ code: "quota_used", used: 3 });
        await b.query("commit");
        expect(await count(id)).toBe(3);
      });

      it("a reveal blocked behind an uncommitted open → received answers not_open", async () => {
        const { id } = await attemptIn("open", HINT_SNAPSHOT);
        const [a, b] = [await client(), await client()];
        await a.query("begin");
        await a.query("set local role service_role");
        await a.query("update public.attempts set status = 'received' where id = $1 and status = 'open'", [id]);
        await b.query("begin");
        await b.query("set local role service_role");
        const blocked = revealIn(b, id, 1, 0);
        await lockWaiter();
        await a.query("commit");
        expect(await blocked).toMatchObject({ code: "not_open" });
        await b.query("commit");
        expect(await count(id)).toBe(0);
      });
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
