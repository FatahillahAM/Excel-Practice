// @vitest-environment jsdom
import "@/test/dom";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

function expectStill(score: number) {
  expect(badge().hasAttribute("data-animate")).toBe(false);
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

type Nav = Navigator & { deviceMemory?: number; connection?: unknown };
afterEach(() => {
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
    expectStill(result.score);
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
    expectStill(88);
  });

  it.each([
    ["Settings switch", () => (document.documentElement.dataset.motion = "reduce")],
    ["OS preference", () => mockReducedMotion(true)],
  ])("reduced motion (%s) is still with the final score", (_name, reduce) => {
    reduce();
    const first = view(PRACTICE_85);
    expectStill(85);
    expect(badge().dataset.glow).toBe("true");
    first.unmount();
    view(TEST_88, { item: TEST });
    expectStill(88);
  });

  it("turning the switch on while open removes the motion and the fire", async () => {
    view(TEST_88, { item: TEST });
    expect(fires()).toHaveLength(1);
    await act(async () => {
      document.documentElement.dataset.motion = "reduce";
    });
    expectStill(88);
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
