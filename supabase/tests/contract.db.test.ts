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
    for (const next of steps[status]) await db.query("update public.attempts set status = $2 where id = $1", [id, next]);
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

    it.each(["graded", "grading_failed", "closed", "open"])(
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

  describe("upload: received (session + RLS)", () => {
    /** The upload's compare-and-set: `update … set status = 'received' where id = ? and status = 'open'`. */
    function receiveAs(uid: string, id: string) {
      return asUser(uid, async (q) =>
        (await q.query("update public.attempts set status = 'received' where id = $1 and status = 'open' returning id", [id]))
          .rowCount,
      );
    }

    it("moves the owner's open attempt to received and stamps received_at", async () => {
      const { uid, id } = await attemptIn("open");
      expect(await receiveAs(uid, id)).toBe(1);
      const r = await row(id);
      expect(r.status).toBe("received");
      expect(r.received_at).toBeInstanceOf(Date);
      expect(Math.abs(r.received_at!.getTime() - Date.now())).toBeLessThan(60_000);
      // A second post loses the compare-and-set: no row.
      expect(await receiveAs(uid, id)).toBe(0);
    });

    it("matches no row of another user", async () => {
      const { id } = await attemptIn("open");
      const stranger = await newUser();
      expect(await receiveAs(stranger, id)).toBe(0);
      expect((await row(id)).status).toBe("open");
    });

    it.each([
      ["received", "graded"],
      ["received", "grading_failed"],
      ["grading_failed", "graded"],
    ] as const)("refuses the owner moving a %s attempt to %s", async (from, to) => {
      const { uid, id } = await attemptIn(from);
      await expectSqlError(
        asUser(uid, (q) => q.query("update public.attempts set status = $2 where id = $1", [id, to])),
        "42501",
      );
      expect((await row(id)).status).toBe(from);
    });

    it("leaves the service role's moves alone (grading_failed back to received)", async () => {
      const { id } = await attemptIn("grading_failed");
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
    });
  });

  describe("attempt-files (Storage RLS)", () => {
    /** Storage's upsert of one object, as the user: insert, or update the existing row. */
    function putAs(uid: string, name: string) {
      return asUser(uid, async (q) =>
        (
          await q.query(
            `insert into storage.objects (bucket_id, name, owner) values ('attempt-files', $1, $2)
             on conflict (bucket_id, name) do update set owner = excluded.owner, created_at = now()
             returning id`,
            [name, uid],
          )
        ).rowCount,
      );
    }
    const objects = async (name: string) =>
      (await db.query("select id from storage.objects where bucket_id = 'attempt-files' and name = $1", [name])).rowCount;

    it("lets the owner write and overwrite submission-1 while the attempt is open", async () => {
      const { uid, id } = await attemptIn("open");
      const name = `${id}/submission-1.xlsm`;
      expect(await putAs(uid, name)).toBe(1);
      expect(await putAs(uid, name)).toBe(1);
      expect(await objects(name)).toBe(1);
    });

    it("refuses submission-1 once the attempt is received, also overwriting the stored one", async () => {
      const { uid, id } = await attemptIn("open");
      const name = `${id}/submission-1.xlsm`;
      expect(await putAs(uid, name)).toBe(1);
      await db.query("update public.attempts set status = 'received' where id = $1", [id]);
      await expectSqlError(putAs(uid, name), "42501");

      const other = await attemptIn("received");
      await expectSqlError(putAs(other.uid, `${other.id}/submission-1.xlsm`), "42501");
    });

    it("refuses another user's attempt", async () => {
      const { id } = await attemptIn("open");
      const stranger = await newUser();
      await expectSqlError(putAs(stranger, `${id}/submission-1.xlsm`), "42501");
      expect(await objects(`${id}/submission-1.xlsm`)).toBe(0);
    });

    it("refuses other names: submission-2 and overwriting generated.xlsm", async () => {
      const { uid, id } = await attemptIn("open");
      await expectSqlError(putAs(uid, `${id}/submission-2.xlsm`), "42501");
      // Start's one write of the generated file is allowed; replacing it is not.
      expect(await putAs(uid, `${id}/generated.xlsm`)).toBe(1);
      await expectSqlError(putAs(uid, `${id}/generated.xlsm`), "42501");
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
