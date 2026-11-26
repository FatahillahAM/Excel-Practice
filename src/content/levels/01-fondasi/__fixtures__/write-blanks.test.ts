import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readWorkbook } from "@/adapters/workbook/read";
import { buildFixture as buildP2 } from "./l01-p2";
import { buildFixture as buildT } from "./l01-t";

/**
 * The files the user opens in Excel 2021 for the hitl fixtures (README.md ›
 * L01-P2 and L01-T): `buildFixture("blank")` of each item, as Start would
 * generate it. Not written in a normal run; to write them:
 *
 *   WRITE_L01_BLANKS=/path/to/dir npx vitest run src/content/levels/01-fondasi/__fixtures__/write-blanks.test.ts
 *
 * writes `l01-p2-blank.xlsm` and `l01-t-blank.xlsm` into that directory (never into the repo).
 */

export const BLANKS = { "l01-p2-blank.xlsm": () => buildP2("blank"), "l01-t-blank.xlsm": () => buildT("blank") } as const;

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

const target = process.env.WRITE_L01_BLANKS;

describe("L01 blank fixtures for Excel", () => {
  it.each(Object.keys(BLANKS))("%s is a readable workbook without a Table or answers", async (name) => {
    const reading = await readWorkbook(await BLANKS[name as keyof typeof BLANKS]());
    expect(reading.tables?.Data).toEqual([]);
    expect(reading.sheets.Data.A1).toMatchObject({ value: "Kode Batch" });
  });

  it.runIf(target !== undefined && target !== "")("writes them into WRITE_L01_BLANKS", async () => {
    const files = await writeBlankFixtures(path.resolve(target!));
    console.log(`wrote ${files.join(", ")}`);
    expect(files).toHaveLength(2);
  });
});
