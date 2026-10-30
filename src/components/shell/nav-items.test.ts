import { describe, expect, it } from "vitest";
import { GENERAL_ITEMS, MENU_ITEMS, activeNavItem, surfaceTitle } from "./nav-items";

describe("menu", () => {
  it("lists the EXPERIENCE.md groups in order", () => {
    expect(MENU_ITEMS.map((i) => i.label)).toEqual([
      "Dashboard",
      "Level Map",
      "History",
      "Records",
      "Tips & Tricks",
      "Setup Guide",
    ]);
    expect(GENERAL_ITEMS.map((i) => i.label)).toEqual(["Settings"]);
  });

  it("uses kebab-case routes", () => {
    expect([...MENU_ITEMS, ...GENERAL_ITEMS].map((i) => i.href)).toEqual([
      "/dashboard",
      "/levels",
      "/history",
      "/records",
      "/tips",
      "/setup-guide",
      "/settings",
    ]);
  });
});

describe("activeNavItem", () => {
  it.each([
    ["/dashboard", "Dashboard"],
    ["/levels", "Level Map"],
    ["/history", "History"],
    ["/history/", "History"],
    ["/history/abc-123", "History"],
    ["/records", "Records"],
    ["/tips", "Tips & Tricks"],
    ["/setup-guide", "Setup Guide"],
    ["/settings", "Settings"],
  ])("%s → %s", (path, label) => {
    expect(activeNavItem(path)?.label).toBe(label);
  });

  it.each(["/", "/exam/abc", "/results/abc", "/historyx", "/tipsy", "/dash", "", null, undefined])(
    "marks nothing on %j",
    (path) => {
      expect(activeNavItem(path)).toBeNull();
    },
  );
});

describe("surfaceTitle", () => {
  it("names the surface first", () => {
    expect(surfaceTitle("Tips & Tricks")).toBe("Tips & Tricks · WORKING HARD with EXCEL");
  });
});
