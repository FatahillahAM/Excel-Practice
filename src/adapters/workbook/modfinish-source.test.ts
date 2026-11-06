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

/** The text of `Private Const <name> As String = "..."` in the `.bas`, quotes unescaped. */
function constantText(bas: string, name: string): string | undefined {
  const match = bas.match(new RegExp(`Private Const ${name} As String = "((?:[^"\\r\\n]|"")*)"\\r\\n`));
  return match?.[1].replaceAll('""', '"');
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

  it.each(REJECTION_CODES)("maps the rejection code %s to its own message", async (code) => {
    const bas = await source();
    const assigned = bas.match(new RegExp(`Case "${code}"\\r\\n\\s+RejectionText = (\\w+)\\r\\n`));
    expect(assigned, code).not.toBeNull();
    expect(constantText(bas, assigned![1])).toBe(macroMessages[code]);
  });

  it("shows the sent message only for 200 with \"ok\":true, and the too-large message for 413", async () => {
    const bas = await source();
    const sent = bas.match(/If httpStatus = 200 And InStr\(1, answerText, """ok"":true", vbBinaryCompare\) > 0 Then\r\n\s+msg = (\w+)\r\n/);
    expect(sent).not.toBeNull();
    expect(constantText(bas, sent![1])).toBe(macroMessages.sent);
    const tooLarge = bas.match(/ElseIf httpStatus = 413 Then\r\n(?:\s*'[^\r\n]*\r\n)*\s+msg = (\w+) /);
    expect(tooLarge).not.toBeNull();
    expect(constantText(bas, tooLarge![1])).toBe(macroMessages.FILE_TOO_LARGE);
  });

  it("refuses files over MAX_SUBMISSION_BYTES before sending", async () => {
    const bas = await source();
    expect(bas).toContain(`Private Const MAX_SUBMISSION_BYTES As Long = ${MAX_SUBMISSION_BYTES}\r\n`);
    const checks = [...bas.matchAll(/If byteCount > MAX_SUBMISSION_BYTES Then\r\n(?:\s+DeleteCopy copyPath\r\n)?\s+ShowRefusal (\w+),/g)];
    expect(checks).toHaveLength(2);
    for (const check of checks) expect(constantText(bas, check[1])).toBe(macroMessages.FILE_TOO_LARGE);
    const send = bas.indexOf("xhr.send (fileBytes)");
    expect(send).toBeGreaterThan(0);
    for (const check of checks) expect(check.index).toBeLessThan(send);
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
