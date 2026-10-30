import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CURRENT_TEMPLATE_VERSION, templates } from "./src/adapters/workbook/templates";
import { NAV_ITEMS } from "./src/components/shell/nav-items";
import nextConfig from "./next.config";

describe("next.config redirects", () => {
  it("sends / to Dashboard with one non-permanent 307 rule", async () => {
    const rules = await nextConfig.redirects?.();
    expect(rules).toEqual([{ source: "/", destination: "/dashboard", permanent: false }]);
  });

  it("points at a real menu route", async () => {
    const [rule] = (await nextConfig.redirects?.()) ?? [];
    expect(NAV_ITEMS.map((item) => item.href)).toContain(rule?.destination);
  });
});

describe("next.config outputFileTracingIncludes", () => {
  it("ships the current exam template with the bridge proof download route", () => {
    const includes = nextConfig.outputFileTracingIncludes ?? {};
    expect(Object.keys(includes)).toContain("/dev/bridge-proof/download");
    expect(existsSync("src/app/(app)/dev/bridge-proof/download/route.ts")).toBe(true);

    const file = templates[CURRENT_TEMPLATE_VERSION].file;
    expect(existsSync(file)).toBe(true);
    // A glob covers the file when the part before its first wildcard is a prefix of the file's path.
    const covers = (glob: string) => {
      const prefix = glob.replace(/^\.\//, "").split("*")[0];
      return glob.includes("*") && file.startsWith(prefix);
    };
    expect(includes["/dev/bridge-proof/download"].some(covers)).toBe(true);
  });
});
