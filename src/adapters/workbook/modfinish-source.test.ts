import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MAX_SUBMISSION_BYTES, REJECTION_CODES } from "../../core/submission";
import { macroMessages } from "../../messages/id";

// The Finish macro's source as the repo keeps it for import into the template
// (assets/templates/README.md). The texts live once, in `macroMessages`; this
// test holds the `.bas` to them, and to the server contract it posts against.

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const BAS = path.join(repoRoot, "assets/templates/vba/modFinish.bas");

/** A message as a VBA expression: one string literal, `""` for a quote, the em dash as `ChrW$(8212)`. */
function vbaExpression(text: string): string {
  return `"${text.replaceAll('"', '""').replaceAll("—", '" & ChrW$(8212) & "')}"`;
}

async function source(): Promise<string> {
  return (await readFile(BAS)).toString("latin1");
}

describe("modFinish.bas", () => {
  it("is ASCII with CRLF line endings only", async () => {
    const bytes = await readFile(BAS);
    expect(bytes.every((b) => b < 0x80)).toBe(true);
    const text = bytes.toString("latin1");
    expect(text.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
    expect(text.endsWith("\r\n")).toBe(true);
  });

  it.each(Object.entries(macroMessages))("holds macroMessages.%s verbatim", async (_key, text) => {
    expect(await source()).toContain(vbaExpression(text));
  });

  it.each(REJECTION_CODES)("maps the rejection code %s", async (code) => {
    expect(await source()).toContain(`Case "${code}"`);
  });

  it("refuses files over MAX_SUBMISSION_BYTES before sending", async () => {
    expect(await source()).toContain(`Private Const MAX_SUBMISSION_BYTES As Long = ${MAX_SUBMISSION_BYTES}\r\n`);
  });

  it("posts to the macro route", async () => {
    const match = (await source()).match(/Private Const SUBMIT_PATH As String = "([^"]+)"/);
    expect(match?.[1]).toBe("/api/submissions/macro");
    expect(existsSync(path.join(repoRoot, "src/app", match![1], "route.ts"))).toBe(true);
  });

  it("keeps `MsgBox msg`, which the registry test mutates", async () => {
    expect(await source()).toContain("MsgBox msg");
  });
});
