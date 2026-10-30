import { describe, expect, it } from "vitest";
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
