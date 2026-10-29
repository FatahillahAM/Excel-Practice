/**
 * Lints snippets with the project's real ESLint config to prove the AD-1 rule
 * on `src/core/**` (lives outside core because it imports `eslint` and `node:*`).
 */
import { ESLint } from "eslint";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const AD1_RULES = [
  "no-restricted-imports",
  "import/no-restricted-paths",
  "no-restricted-syntax",
  "no-restricted-globals",
];

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({ cwd: root });
});

async function ad1Errors(file: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath: path.join(root, file) });
  return result.messages.filter((m) => m.ruleId !== null && AD1_RULES.includes(m.ruleId));
}

async function expectRejected(file: string, code: string) {
  const errors = await ad1Errors(file, code);
  expect(errors.length, `${file}: ${code}`).toBeGreaterThan(0);
  for (const e of errors) {
    expect(e.severity).toBe(2);
    expect(e.message).toContain("AD-1");
  }
}

async function expectAllowed(file: string, code: string) {
  expect(await ad1Errors(file, code), `${file}: ${code}`).toEqual([]);
}

describe("AD-1 import rule", { timeout: 60_000 }, () => {
  describe("rejects framework and IO imports in core", () => {
    it.each([
      'import { NextResponse } from "next/server";',
      'import next from "next";',
      'import { useState } from "react";',
      'import { createServerClient } from "@supabase/ssr";',
      'import { readFileSync } from "node:fs";',
      'import fs from "fs";',
      'import type { NextRequest } from "next/server";',
      'export { NextResponse } from "next/server";',
      'export * from "react";',
      'const m = await import("next/server");',
      'const fs = require("node:fs");',
      'const fs = module.require("fs");',
      'const fs = globalThis.require("fs");',
      'type T = typeof import("next/server");',
    ])("%s", async (code) => {
      await expectRejected("src/core/x.ts", code);
    });

    it.each([
      ["src/core/x.tsx", 'import { useState } from "react";'],
      ["src/core/x.mts", 'import { NextResponse } from "next/server";'],
      ["src/core/x.js", 'import { NextResponse } from "next/server";'],
    ])("%s: %s", async (file, code) => {
      await expectRejected(file, code);
    });

    it("still rejects framework imports in core test files", async () => {
      await expectRejected("src/core/x.test.ts", 'import { NextResponse } from "next/server";');
    });

    it("rejects vitest outside core test files", async () => {
      await expectRejected("src/core/x.ts", 'import { it } from "vitest";');
    });
  });

  describe("rejects IO through globals in core", () => {
    it.each(['fetch("x");', "export const x = process.env.X;"])("%s", async (code) => {
      await expectRejected("src/core/x.ts", code);
    });
  });

  describe("rejects imports that leave core", () => {
    it.each([
      ["src/core/x.ts", 'import { createClient } from "@/adapters/supabase/server";'],
      ["src/core/x.ts", 'import { cn } from "@/lib/utils";'],
      ["src/core/x.ts", 'import Page from "@/app/page";'],
      ["src/core/x.ts", 'import { createClient } from "../adapters/supabase/server";'],
      ["src/core/a/b.ts", 'import { createClient } from "../../adapters/supabase/server";'],
      ["src/core/a/b.ts", 'import { cn } from "../../lib/utils";'],
      ["src/core/a/b.ts", 'import "../../proxy";'],
      ["src/core/a/b.ts", 'import { x } from "../../../scripts/spike-s1";'],
      ["src/core/x.ts", 'import pkg from "../../package.json";'],
      ["src/core/x.ts", 'import { NextResponse } from "../../node_modules/next/server";'],
      ["src/core/x.ts", 'import { RejectionCode } from "@/core/../adapters/supabase/server";'],
    ])("%s: %s", async (file, code) => {
      await expectRejected(file, code);
    });
  });

  describe("allows core-internal and zod imports", () => {
    it.each([
      ["src/core/x.ts", 'import { z } from "zod";'],
      ["src/core/x.ts", 'import { z } from "zod/v4";'],
      ["src/core/x.ts", 'import { RejectionCode } from "@/core/submission/rejection-codes";'],
      ["src/core/x.ts", 'import { RejectionCode } from "./submission/rejection-codes";'],
      ["src/core/submission/x.ts", 'import { RejectionCode } from "./rejection-codes";'],
      ["src/core/a/b.ts", 'import { RejectionCode } from "../submission/rejection-codes";'],
      ["src/core/a/b/c.ts", 'import { RejectionCode } from "../../submission/rejection-codes";'],
      ["src/core/x.test.ts", 'import { describe, it } from "vitest";'],
      ["src/core/x.spec.ts", 'import { describe, it } from "vitest";'],
      ["src/core/x.test.ts", 'import { startVitest } from "vitest/node";'],
    ])("%s: %s", async (file, code) => {
      await expectAllowed(file, code);
    });
  });

  describe("does not apply outside core", () => {
    it.each([
      ["src/app/x.ts", 'import { NextResponse } from "next/server";'],
      ["src/app/x.ts", 'import { useState } from "react";'],
      ["src/adapters/x.ts", 'import { readFileSync } from "node:fs";'],
      ["src/adapters/x.ts", 'import { createClient } from "@/adapters/supabase/server";'],
      ["src/app/x.ts", 'const m = await import("next/server");'],
    ])("%s: %s", async (file, code) => {
      await expectAllowed(file, code);
    });
  });
});
