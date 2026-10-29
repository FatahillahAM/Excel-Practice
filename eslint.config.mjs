import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// AD-1: `src/core/**` imports only `src/core/**` and `zod`.
const AD1_MESSAGE =
  "AD-1: src/core imports only src/core/** and zod (no next, react, @supabase/*, node:*, IO, or other src layers). Pass ports in as arguments.";

// Any import source that is not `zod`, `@/core`, or a relative path. Relative
// paths that leave src/core are caught by `import/no-restricted-paths` below.
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const notCoreAllowed = (extra = []) =>
  `^(?!(${["zod", "@/core", ...extra].map(escapeRegex).join("|")})(/|$)|\\.\\.?(/|$))`;

// IO and environment reached through globals instead of imports.
const IO_GLOBALS = [
  "fetch",
  "process",
  "XMLHttpRequest",
  "WebSocket",
  "window",
  "document",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "navigator",
];

const coreImportRules = (extraAllowed = []) => ({
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
          from: ".",
          except: ["./src/core", ...["zod", ...extraAllowed].map((p) => `./node_modules/${p}`)],
          message: AD1_MESSAGE,
        },
      ],
    },
  ],
  "no-restricted-syntax": [
    "error",
    { selector: "ImportExpression", message: `${AD1_MESSAGE} Dynamic import() is not allowed in core.` },
    { selector: "TSImportType", message: `${AD1_MESSAGE} import() types are not allowed in core.` },
    {
      selector: "CallExpression[callee.name='require']",
      message: `${AD1_MESSAGE} require() is not allowed in core.`,
    },
    {
      selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='require']",
      message: `${AD1_MESSAGE} require() is not allowed in core.`,
    },
  ],
  "no-restricted-globals": [
    "error",
    ...IO_GLOBALS.map((name) => ({ name, message: `${AD1_MESSAGE} No IO through the \`${name}\` global.` })),
  ],
});

const CORE_EXT = "{ts,tsx,mts,cts,js,jsx,mjs,cjs}";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    name: "ad-1/core-imports",
    files: [`src/core/**/*.${CORE_EXT}`],
    rules: coreImportRules(),
  },
  {
    // Core tests may also import the test runner.
    name: "ad-1/core-tests",
    files: [`src/core/**/*.{test,spec}.${CORE_EXT}`],
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
