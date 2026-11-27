import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readWorkbook } from "@/adapters/workbook/read";
import { buildFixture as buildP1 } from "./l02-p1";
import { buildFixture as buildT } from "./l02-t";

/**
 * The files the user opens in Excel 2021 for the hitl fixtures (README.md ›
 * L02-P1 and L02-T): `buildFixture("blank")` of each item, as Start would
 * generate it. Not written in a normal run; to write them:
 *
 *   WRITE_L02_BLANKS=/path/to/dir npx vitest run src/content/levels/02-logika/__fixtures__/write-blanks.test.ts
 *
 * writes `l02-p1-blank.xlsm` and `l02-t-blank.xlsm` into that directory (never into the repo).
 */

export const BLANKS = { "l02-p1-blank.xlsm": () => buildP1("blank"), "l02-t-blank.xlsm": () => buildT("blank") } as const;

/** Writes every blank into `dir`; returns the written paths. */
export async function writeBlankFixtures(dir: string): Promise<string[]> {
  await mkdir(dir, { recursive: true });
  const written: string[] = [];
  for (const [name, build] of Object.entries(BLANKS)) {
    const file = path.join(dir, name);
    await writeFile(file, await build());
    written.push(file);
  }
  return written;
}

const target = process.env.WRITE_L02_BLANKS;

describe("L02 blank fixtures for Excel", () => {
  it.each(Object.keys(BLANKS))("%s is a readable workbook without answers", async (name) => {
    const reading = await readWorkbook(await BLANKS[name as keyof typeof BLANKS]());
    expect(reading.sheets.Data.A1).toMatchObject({ value: "Kode Batch" });
    expect(reading.sheets.Data.O2).toMatchObject({ value: 1250 });
    expect(reading.sheets.Data.H2).toBeUndefined();
  });

  it.runIf(target !== undefined && target !== "")("writes them into WRITE_L02_BLANKS", async () => {
    const files = await writeBlankFixtures(path.resolve(target!));
    console.log(`wrote ${files.join(", ")}`);
    expect(files).toHaveLength(2);
  });
});
