// @vitest-environment jsdom
import "@/test/dom";
import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSessionUser: vi.fn(), listProgressAttempts: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: () => {} }));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: mocks.getSessionUser }));
vi.mock("@/adapters/supabase/server", () => ({ createClient: async () => ({ session: true }) }));
vi.mock("@/adapters/supabase/attempts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/adapters/supabase/attempts")>()),
  listProgressAttempts: mocks.listProgressAttempts,
}));

import type { LevelModule } from "@/core/content/level-module";
import { PRACTICE_85, TEST_72, TEST_88 } from "@/core/grading/__fixtures__/results";
import { levelProgress, toGradedAttempts } from "@/core/progress";
import { shellMessages } from "@/messages/id";
import { LevelPath, LevelPathSkeleton, LevelPathView } from "./level-path";

const row = (id: string, itemId: string, result: unknown) => ({
  id,
  itemId,
  result,
  startedAt: "2026-11-02T01:00:00+00:00",
  receivedAt: "2026-11-02T01:10:00+00:00",
});

async function show() {
  return render((await LevelPath()) as ReactElement);
}
const nodes = () => within(screen.getByRole("navigation", { name: "Level path" })).getAllByRole("listitem");
const states = () => nodes().map((li) => li.getAttribute("data-state"));
const logged = () => vi.mocked(console.error).mock.calls.map((c) => JSON.parse(c[0] as string));

beforeEach(() => {
  mocks.getSessionUser.mockResolvedValue({ id: "user-1", email: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  mocks.getSessionUser.mockReset();
  mocks.listProgressAttempts.mockReset();
});

describe("Level Path", () => {
  it("empty: Level 1 → Ujian Akhir, Level 1 active with 0/5, the rest Under Construction", async () => {
    mocks.listProgressAttempts.mockResolvedValue({ ok: true, value: [] });
    await show();
    expect(mocks.listProgressAttempts).toHaveBeenCalledWith({ session: true }, "user-1");
    const items = nodes();
    expect(items).toHaveLength(10);
    expect(items[0].textContent).toContain("Level 1");
    expect(items[0].textContent).toContain("Fondasi");
    expect(items[9].textContent).toContain("Ujian Akhir");
    expect(states()).toEqual(["active", ...Array(9).fill("under_construction")]);
    expect(items[0].getAttribute("aria-current")).toBe("step");
    expect(items.filter((li) => li.hasAttribute("aria-current"))).toHaveLength(1);
    expect(items[0].textContent).toContain("0/5 practices done");
    expect(items[0].querySelectorAll("[data-pip]")).toHaveLength(5);
    expect(items[1].textContent).toContain("Under Construction");
  });

  it("one practice graded (repeated): 1/5 with one done pip; the Test failing (72) keeps Level 1 active", async () => {
    mocks.listProgressAttempts.mockResolvedValue({
      ok: true,
      value: [row("a", "L01-P1", PRACTICE_85), row("b", "L01-P1", PRACTICE_85), row("t", "L01-T", TEST_72)],
    });
    await show();
    expect(nodes()[0].textContent).toContain("1/5 practices done");
    expect(nodes()[0].querySelectorAll('[data-pip="done"]')).toHaveLength(1);
    expect(states()[0]).toBe("active");
  });

  it("an invalid Result is not counted, the rest shows, and it is logged", async () => {
    mocks.listProgressAttempts.mockResolvedValue({ ok: true, value: [row("bad", "L01-P1", { version: 9 })] });
    await show();
    expect(nodes()[0].textContent).toContain("0/5 practices done");
    expect(logged()).toEqual([{ event: "progress.result_invalid", attemptId: "bad" }]);
  });

  it("passed / active / locked: a passed Test opens the next level", () => {
    const l2 = { id: "02-x", number: 2, name: "Logika", phase: "v1", items: [{ id: "L02-P1", kind: "practice", number: 1 }, { id: "L02-T", kind: "test", number: 6 }] };
    const l1 = { ...l2, id: "01-x", number: 1, name: "Fondasi", items: [{ id: "L01-P1", kind: "practice", number: 1 }, { id: "L01-T", kind: "test", number: 6 }] };
    const l3 = { ...l2, id: "03-x", number: 3, name: "Hitung bersyarat", items: [{ id: "L03-T", kind: "test", number: 6 }] };
    const modules = [l1, l2, l3] as unknown as LevelModule[];
    render(<LevelPathView progress={levelProgress(toGradedAttempts([row("t", "L01-T", TEST_88)]), modules)} />);
    expect(states().slice(0, 4)).toEqual(["passed", "active", "locked", "under_construction"]);
    expect(nodes()[0].textContent).toContain("Passed");
    expect(nodes()[0].textContent).not.toContain("practices done");
    expect(nodes()[1].getAttribute("aria-current")).toBe("step");
    expect(nodes()[1].textContent).toContain("0/5 practices done");
    expect(nodes()[2].textContent).toContain("Locked");
  });

  it("a failed read: the first-load message with Try again instead of the path", async () => {
    mocks.listProgressAttempts.mockResolvedValue({ ok: false });
    await show();
    expect(screen.getByRole("alert").textContent).toContain(shellMessages.firstLoadFailed);
    expect(screen.getByRole("link", { name: "Try again" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.queryByRole("navigation", { name: "Level path" })).toBeNull();
  });

  it("a throw is a failed read too, logged", async () => {
    mocks.getSessionUser.mockRejectedValue(new TypeError("net"));
    await show();
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(logged()).toEqual([{ event: "progress.load_failed", name: "TypeError" }]);
  });

  it("the skeleton is hidden and shaped like the path", () => {
    const { container } = render(<LevelPathSkeleton />);
    const skeleton = container.querySelector('[data-slot="level-path-skeleton"]')!;
    expect(skeleton.getAttribute("aria-hidden")).toBe("true");
    expect(skeleton.children).toHaveLength(10);
  });
});
