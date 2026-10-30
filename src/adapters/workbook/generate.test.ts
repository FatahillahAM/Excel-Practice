import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateExamWorkbook } from "./generate";
import { readWorkbook } from "./read";
import { vbaProjectSha256 } from "./template-patch";
import { CURRENT_TEMPLATE_VERSION, matchesTemplate, templates } from "./templates";

const newToken = () => randomBytes(32).toString("base64url");
const SERVER_URL = "https://excel-practice-omega.vercel.app";

describe("generateExamWorkbook", () => {
  it("sets the three properties, writes the cells and returns the current template version", async () => {
    const token = newToken();
    const { bytes, templateVersion } = await generateExamWorkbook({
      token,
      serverUrl: SERVER_URL,
      cells: {
        Instructions: { B2: "Judul", B6: "1. Tulis SUMIFS di Data!I2." },
        Data: { A1: "Lini", B1: "Unit", A2: "Lini A", B2: 1200 },
      },
    });

    expect(templateVersion).toBe(CURRENT_TEMPLATE_VERSION);
    const reading = await readWorkbook(bytes);
    expect(reading.properties).toMatchObject({
      WHE_AttemptToken: token,
      WHE_ServerUrl: SERVER_URL,
      WHE_TemplateVersion: String(CURRENT_TEMPLATE_VERSION),
    });
    expect(reading.sheets.Instructions.B2).toMatchObject({ formula: null, value: "Judul", type: "string" });
    expect(reading.sheets.Instructions.B6.value).toBe("1. Tulis SUMIFS di Data!I2.");
    expect(reading.sheets.Data.A2).toMatchObject({ value: "Lini A", type: "string" });
    expect(reading.sheets.Data.B2).toMatchObject({ formula: null, value: 1200, type: "number" });
  });

  it("keeps the VBA project byte for byte, so the fingerprint still matches the template", async () => {
    const { bytes, templateVersion } = await generateExamWorkbook({
      token: newToken(),
      serverUrl: SERVER_URL,
      cells: { Data: { A1: "x" } },
    });
    const template = await readFile(path.join(process.cwd(), templates[CURRENT_TEMPLATE_VERSION].file));

    expect(await vbaProjectSha256(bytes)).toBe(await vbaProjectSha256(template));
    expect(matchesTemplate((await readWorkbook(bytes)).vbaModuleHashes, templateVersion)).toBe(true);
  });

  it.each([[""], ["TEMPLATE"], ["a".repeat(44)], [`${"a".repeat(42)}=`]])("refuses token %j", async (token) => {
    await expect(generateExamWorkbook({ token, serverUrl: SERVER_URL, cells: {} })).rejects.toThrow(/token/);
  });
});
