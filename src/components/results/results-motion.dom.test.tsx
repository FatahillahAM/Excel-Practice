// @vitest-environment jsdom
import "@/test/dom";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FLOORED_0, PRACTICE_64, PRACTICE_85, SCORE_79, SCORE_80, TEST_72, TEST_88, V1_NO_TIPS_80 } from "@/core/grading/__fixtures__/results";
import type { Result } from "@/core/grading/result";
import { ResultsView, type ResultsViewProps } from "./results-view";

const LEVEL = { number: 1, name: "Fondasi" };
const PRACTICE = { kind: "practice", number: 1 } as const;
const TEST = { kind: "test", number: 1 } as const;

function view(result: Result, props: Partial<ResultsViewProps> = {}) {
  return render(
    <ResultsView itemId="L01-P1" item={PRACTICE} level={LEVEL} result={result} durationSeconds={408} mode="live" {...props} />,
  );
}

const heading = () => screen.getByRole("heading", { level: 1 });
const badge = () => document.querySelector<HTMLElement>('[data-slot="score-badge"]')!;
const slot = (name: string) => document.querySelector<HTMLElement>(`[data-slot="${name}"]`);
const fires = () => document.querySelectorAll<HTMLElement>('[data-slot="fire-effect"]');
const scened = () => document.querySelectorAll("[data-scene]");
const scoreText = () => document.querySelector<HTMLElement>('[data-slot="score-badge-score"]')!.textContent;

function expectStill(score: number, glow: "true" | "false") {
  expect(badge().dataset.glow).toBe(glow);
  expect(badge().hasAttribute("data-animate")).toBe(false);
  expect(badge().hasAttribute("data-count")).toBe(false);
  expect(slot("score-badge-back")).toBeNull();
  expect(slot("fire-tint")).toBeNull();
  expect(badge().style.getPropertyValue("--score-n")).toBe("");
  expect(scened()).toHaveLength(0);
  expect(fires()).toHaveLength(0);
  expect(badge().textContent).toBe(`${score}/100`);
}

const realMatchMedia = window.matchMedia;
function mockReducedMotion(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: matches && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

/** Puts the Answers and Tips sections below the viewport (the scroll scene's mount gate), or the given ones in view. */
function placeSections(inView: readonly string[] = []) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const top = inView.includes(this.dataset.slot ?? "") ? 100 : window.innerHeight + 200;
    return { top, bottom: top + 200, left: 0, right: 0, width: 0, height: 200, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  });
}
const panel = () => heading().closest("section")!;
const COUNT_KEY = "excel-practice.results-count-up";

type Nav = Navigator & { deviceMemory?: number; connection?: unknown };
beforeEach(() => placeSections());
afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.matchMedia = realMatchMedia;
  delete document.documentElement.dataset.motion;
  delete (navigator as Nav).deviceMemory;
  delete (navigator as Nav).connection;
  vi.useRealTimers();
});

describe("Results motion", () => {
  it("a practice ≥ 80 turns, counts up and lifts, without fire", () => {
    view(PRACTICE_85);
    expect(badge().dataset.animate).toBe("turn");
    expect(badge().style.getPropertyValue("--score-n")).toBe("85");
    expect(slot("all-correct")!.dataset.scene).toBe("lift");
    expect(slot("tips")!.dataset.scene).toBe("lift");
    expect(fires()).toHaveLength(0);
    expect(slot("score-badge-back")!.textContent).toBe("");
    expect(badge().textContent).toBe("85/100");
    expect(scoreText()).toBe("85");
  });

  it("a Test passed also has one decorative Fire Effect outside the badge", () => {
    view(TEST_88, { item: TEST });
    expect(badge().dataset.animate).toBe("turn");
    expect(slot("wrong-answers")!.dataset.scene).toBe("lift");
    expect(slot("tips")!.dataset.scene).toBe("lift");
    expect(fires()).toHaveLength(1);
    const fire = fires()[0];
    expect(fire.getAttribute("aria-hidden")).toBe("true");
    expect(badge().contains(fire)).toBe(false);
    expect(fire.querySelector("a, button, input, select, textarea, [tabindex]")).toBeNull();
    expect(heading().textContent).toBe("Test passed — 88/100");
    expect(badge().textContent).toBe("88/100");
  });

  it.each([
    ["PRACTICE_64", PRACTICE_64, PRACTICE],
    ["TEST_72", TEST_72, TEST],
    ["FLOORED_0", FLOORED_0, PRACTICE],
  ] as const)("%s is calm and still", (_name, result, item) => {
    view(result, { item });
    expect(badge().dataset.variant).toBe("calm");
    expectStill(result.score, "false");
  });

  it("80 moves, 79 stays still", () => {
    view(SCORE_80);
    expect(badge().dataset.animate).toBe("turn");
    expect(scened().length).toBeGreaterThan(0);
    view(SCORE_79);
    const badges = document.querySelectorAll<HTMLElement>('[data-slot="score-badge"]');
    expect(badges[1].hasAttribute("data-animate")).toBe(false);
    expect(badges[1].dataset.variant).toBe("calm");
  });

  it("an unknown item ≥ 80 turns without fire", () => {
    view(PRACTICE_85, { item: null, level: null });
    expect(badge().dataset.animate).toBe("turn");
    expect(fires()).toHaveLength(0);
  });

  it("static mode has no motion for a Test passed", () => {
    view(TEST_88, { item: TEST, mode: "static" });
    expectStill(88, "false");
  });

  it.each([
    ["Settings switch", () => (document.documentElement.dataset.motion = "reduce")],
    ["OS preference", () => mockReducedMotion(true)],
  ])("reduced motion (%s) is still with the final score", (_name, reduce) => {
    reduce();
    const first = view(PRACTICE_85);
    expectStill(85, "true");
    first.unmount();
    view(TEST_88, { item: TEST });
    expectStill(88, "true");
  });

  it("turning the switch on while open removes the motion and the fire", async () => {
    view(TEST_88, { item: TEST });
    expect(fires()).toHaveLength(1);
    await act(async () => {
      document.documentElement.dataset.motion = "reduce";
    });
    expectStill(88, "true");
  });

  it("plays once per mount: reduced at mount, then full, never starts", async () => {
    document.documentElement.dataset.motion = "reduce";
    view(TEST_88, { item: TEST });
    await act(async () => {
      delete document.documentElement.dataset.motion;
    });
    expectStill(88, "true");
  });

  it("does not replay after reduced motion was turned on and off again", async () => {
    view(TEST_88, { item: TEST });
    await act(async () => {
      document.documentElement.dataset.motion = "reduce";
    });
    await act(async () => {
      delete document.documentElement.dataset.motion;
    });
    expectStill(88, "true");
  });

  it("counts up only after the exam screen's client move, never on a hard load", () => {
    const hard = view(PRACTICE_85);
    expect(badge().dataset.animate).toBe("turn");
    expect(badge().hasAttribute("data-count")).toBe(false);
    hard.unmount();

    window.sessionStorage.setItem(COUNT_KEY, window.location.pathname);
    const moved = view(PRACTICE_85);
    expect(badge().dataset.count).toBe("up");
    expect(window.sessionStorage.getItem(COUNT_KEY)).toBeNull();
    moved.unmount();

    window.sessionStorage.setItem(COUNT_KEY, "/results/another");
    view(PRACTICE_85);
    expect(badge().hasAttribute("data-count")).toBe(false);
  });

  it("the Outcome panel keeps the 3.6 frame: never overflow-hidden; the tint only with full motion", () => {
    const test = view(TEST_88, { item: TEST });
    expect(panel().className).not.toContain("overflow-hidden");
    expect(slot("fire-tint")).not.toBeNull();
    expect(slot("fire-tint")!.getAttribute("aria-hidden")).toBe("true");
    test.unmount();
    view(PRACTICE_85);
    expect(panel().className).not.toContain("overflow-hidden");
    expect(slot("fire-tint")).toBeNull();
  });

  it("the fire sits in the badge column, behind the badge", () => {
    view(TEST_88, { item: TEST });
    const fire = fires()[0];
    expect(fire.parentElement).toBe(badge().parentElement);
  });

  it("a section already in view at mount does not lift", () => {
    placeSections(["wrong-answers"]);
    view(TEST_88, { item: TEST });
    expect(slot("wrong-answers")!.hasAttribute("data-scene")).toBe(false);
    expect(slot("tips")!.dataset.scene).toBe("lift");
  });

  it.each([
    ["deviceMemory 4", () => Object.defineProperty(navigator, "deviceMemory", { configurable: true, value: 4 })],
    ["saveData", () => Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } })],
  ])("%s keeps the turn and drops the scene", (_name, set) => {
    set();
    view(PRACTICE_85);
    expect(badge().dataset.animate).toBe("turn");
    expect(scened()).toHaveLength(0);
  });

  it("a Result without Tips lifts only the wrong answers", () => {
    view(V1_NO_TIPS_80);
    expect(slot("wrong-answers")!.dataset.scene).toBe("lift");
    expect(slot("tips")).toBeNull();
  });

  it("no JS timer drives the count-up; the text is final throughout", async () => {
    vi.useFakeTimers();
    // The 3.6 static frame (no motion) arms the same timers as the moving one:
    // the one pending React/carousel task is not motion.
    const flush = () =>
      act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    const frame = view(PRACTICE_85, { mode: "static" });
    await flush();
    const still = vi.getTimerCount();
    frame.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    view(PRACTICE_85);
    await flush();
    expect(badge().dataset.animate).toBe("turn");
    expect(vi.getTimerCount()).toBe(still);
    let elapsed = 0;
    for (const at of [0, 150, 500, 1000, 2000]) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(at - elapsed);
      });
      elapsed = at;
      expect(scoreText()).toBe("85");
      expect(badge().textContent).toBe("85/100");
      expect(heading().textContent).toBe("Practice 1 — 85/100");
      expect(badge().querySelector("[aria-live], [aria-label]")).toBeNull();
      expect(badge().hasAttribute("aria-live")).toBe(false);
    }
    expect(vi.getTimerCount()).toBe(0);
  });
});
