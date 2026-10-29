import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// AD-1: `src/core/**` imports only `src/core/**` and `zod`.
const AD1_MESSAGE =
  "AD-1: src/core imports only src/core/** and zod (no next, react, @supabase/*, node:*, IO, or other src layers). Pass ports in as arguments.";

// Any import source that is not `zod`, `@/core`, or a relative path. Relative
// paths that leave src/core are caught by `import/no-restricted-paths` below.
const notCoreAllowed = (extra = []) =>
  `^(?!(${["zod", "@/core", ...extra].join("|")})(/|$)|\\.\\.?(/|$))`;

const coreImportRules = (extraAllowed) => ({
  "no-restricted-imports": [
    "error",
    {
      patterns: [{ regex: notCoreAllowed(extraAllowed), message: AD1_MESSAGE }],
    },
  ],
  "import/no-restricted-paths": [
    "error",
    {
      zones: [
        {
          target: "./src/core",
          from: "./src",
          except: ["./core"],
          message: AD1_MESSAGE,
        },
      ],
    },
  ],
  "no-restricted-syntax": [
    "error",
    { selector: "ImportExpression", message: `${AD1_MESSAGE} Dynamic import() is not allowed in core.` },
    {
      selector: "CallExpression[callee.name='require']",
      message: `${AD1_MESSAGE} require() is not allowed in core.`,
    },
  ],
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    name: "ad-1/core-imports",
    files: ["src/core/**/*.{ts,tsx}"],
    rules: coreImportRules(),
  },
  {
    // Core tests may also import the test runner.
    name: "ad-1/core-tests",
    files: ["src/core/**/*.test.{ts,tsx}"],
    rules: coreImportRules(["vitest"]),
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "_bmad/**",
    "_bmad-output/**",
    ".claude/**",
    "reference_ux/**",
  ]),
]);

export default eslintConfig;
