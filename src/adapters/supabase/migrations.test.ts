import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// /health reports `app_meta.schema_version`; it only means "the schema this
// environment runs" if every migration sets it to its own version.
const migrationsDir = fileURLToPath(new URL("../../../supabase/migrations", import.meta.url));
const FILE_RE = /^(\d{14})_[a-z0-9_]+\.sql$/;

describe("supabase/migrations", () => {
  it("names every file <14-digit version>_<snake_case>.sql with a unique version", async () => {
    const files = await readdir(migrationsDir);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(file).toMatch(FILE_RE);
    const versions = files.map((file) => file.slice(0, 14));
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("sets app_meta.schema_version to its own version in every migration", async () => {
    for (const file of await readdir(migrationsDir)) {
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      const version = file.slice(0, 14);
      expect(sql, file).toContain("schema_version");
      expect(sql, file).toContain(`'${version}'`);
    }
  });
});
