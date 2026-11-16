// @vitest-environment jsdom
import "@/test/dom";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FLOORED_0,
  PARTIAL_TIPS,
  PRACTICE_64,
  PRACTICE_85,
  RESULT_FIXTURES,
  SCORE_79,
  SCORE_80,
  TEST_72,
  TEST_88,
  V1_NO_TIPS,
  V1_NO_TIPS_80,
} from "@/core/grading/__fixtures__/results";
import { resultSchema, type Result } from "@/core/grading/result";
import { ResultsFocus } from "./results-focus";
import { SCROLL_SETTLE_MS } from "./results-details";
import { ResultsView, type ResultsViewProps } from "./results-view";
import { TipsCard } from "./tips-card";

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
const cards = () => Array.from(document.querySelectorAll<HTMLElement>('[data-slot="tips-card"]'));
const rows = () => Array.from(document.querySelectorAll<HTMLElement>('[data-slot="wrong-answer-row"]'));
const region = () => screen.getByRole("region", { name: "Tips" });
const prev = () => screen.getByRole("button", { name: "Previous tip" });
const next = () => screen.getByRole("button", { name: "Next tip" });
const position = () => document.querySelector<HTMLElement>('[aria-live="polite"]')!;
const current = () => document.querySelector<HTMLElement>('[data-current="true"]')!;

describe("Result fixtures", () => {
  it.each(Object.entries(RESULT_FIXTURES))("%s passes resultSchema", (_name, fixture) => {
    expect(resultSchema.safeParse(JSON.parse(JSON.stringify(fixture))).success).toBe(true);
  });

  it("have the scores their names say", () => {
    expect(Object.values(RESULT_FIXTURES).map((fixture) => fixture.score)).toEqual([85, 64, 80, 79, 88, 72, 75, 50, 80, 0]);
  });
});

describe("ResultsView variants", () => {
  it("practice ≥ 80: outcome heading, glowing badge, deduction, count, time, Semua benar! and a card per question", () => {
    view(PRACTICE_85);
    expect(heading().textContent).toBe("Practice 1 — 85/100");
    expect(slot("results")!.dataset.variant).toBe("pass");
    expect(badge().dataset.variant).toBe("pass");
    expect(badge().dataset.mode).toBe("live");
    expect(badge().dataset.glow).toBe("true");
    expect(badge().getAttribute("aria-hidden")).toBe("true");
    expect(badge().textContent).toBe("85/100");
    const face = badge().querySelector('[data-slot="score-badge-disc"] > [data-slot="score-badge-face"]')!;
    expect(face.textContent).toBe("85/100");
    expect(slot("deduction")!.textContent).toBe("Hint ×3 −15");
    expect(within(slot("deduction")!).getByText("−15").className).toContain("text-warning");
    expect(slot("level-label")!.textContent).toBe("Level 1 — Fondasi");
    expect(within(slot("level-label")!).getByText("Fondasi").getAttribute("lang")).toBe("id");
    expect(slot("correct-count")!.textContent).toBe("4 of 4 correct");
    expect(slot("time")!.textContent).toBe("06:48 time");
    const allCorrect = screen.getByText("Semua benar!");
    expect(allCorrect.getAttribute("lang")).toBe("id");
    expect(allCorrect.className).toContain("text-success");
    expect(allCorrect.closest("section")).toBe(slot("all-correct"));
    expect(rows()).toHaveLength(0);
    expect(screen.queryByRole("heading", { name: /Wrong answers/ })).toBeNull();
    expect(cards()).toHaveLength(4);
    expect(position().textContent).toBe("Tip 1 of 4");
    expect(screen.getByRole("link", { name: "Back to Dashboard" }).getAttribute("href")).toBe("/dashboard");
  });

  it("practice < 80: calm badge, the wrong rows with reasons and See tip, and every card", () => {
    view(PRACTICE_64);
    expect(heading().textContent).toBe("Practice 1 — 64/100");
    expect(slot("results")!.dataset.variant).toBe("calm");
    expect(badge().dataset.variant).toBe("calm");
    expect(badge().dataset.glow).toBe("false");
    expect(badge().outerHTML).not.toContain("glow-strong");
    expect(badge().outerHTML).not.toContain("destructive");
    expect(slot("deduction")!.textContent).toBe("No hints");
    expect(screen.getByRole("heading", { level: 2, name: /Wrong answers/ }).textContent).toBe("Wrong answers 2");
    expect(slot("wrong-answers")!.tagName).toBe("SECTION");
    expect(rows()).toHaveLength(2);
    expect(rows()[0].textContent).toContain("✗ Soal 2");
    expect(rows()[1].textContent).toContain("✗ Soal 3");
    const reason = within(rows()[0]).getByText(PRACTICE_64.questions[1].reasonText!);
    expect(reason.getAttribute("lang")).toBe("id");
    expect(within(rows()[0]).getByText("✗").getAttribute("aria-hidden")).toBe("true");
    expect(within(rows()[0]).getByRole("link", { name: /See tip/ }).getAttribute("href")).toBe("#tip-2");
    expect(within(rows()[1]).getByRole("link", { name: /See tip/ }).getAttribute("href")).toBe("#tip-3");
    expect(screen.queryByText("Semua benar!")).toBeNull();
    expect(cards()).toHaveLength(4);
  });

  it("exactly 80 is the ≥ 80 variant", () => {
    view(SCORE_80);
    expect(heading().textContent).toBe("Practice 1 — 80/100");
    expect(badge().dataset.variant).toBe("pass");
    expect(badge().dataset.glow).toBe("true");
  });

  it("79 is calm", () => {
    view(SCORE_79);
    expect(heading().textContent).toBe("Practice 1 — 79/100");
    expect(badge().dataset.variant).toBe("calm");
    expect(badge().dataset.glow).toBe("false");
  });

  it("Test passed: says so in the heading, with the Test label", () => {
    view(TEST_88, { itemId: "L01-T", item: TEST });
    expect(heading().textContent).toBe("Test passed — 88/100");
    expect(slot("level-label")!.textContent).toBe("Test · Level 1 — Fondasi");
    expect(badge().dataset.variant).toBe("pass");
    expect(slot("results")!.dataset.kind).toBe("test");
  });

  it("Test not passed: says what it needs, calm", () => {
    view(TEST_72, { itemId: "L01-T", item: TEST });
    expect(heading().textContent).toBe("Test not passed — 72/100, needs 80");
    expect(badge().dataset.variant).toBe("calm");
    expect(badge().dataset.glow).toBe("false");
    expect(screen.queryByText(/Try the Test again/)).toBeNull();
  });

  it("static mode: flat badge whatever the score, same content, focus untouched", () => {
    view(PRACTICE_85, { mode: "static" });
    expect(heading().textContent).toBe("Practice 1 — 85/100");
    expect(badge().dataset.mode).toBe("static");
    expect(badge().dataset.variant).toBe("pass");
    expect(badge().dataset.glow).toBe("false");
    expect(slot("deduction")!.textContent).toBe("Hint ×3 −15");
    expect(slot("correct-count")!.textContent).toBe("4 of 4 correct");
    expect(screen.getByText("Semua benar!")).toBeTruthy();
    expect(cards()).toHaveLength(4);
    expect(document.activeElement).toBe(document.body);
  });

  it("legacy Result without Tips: no Tips section and no See tip", () => {
    view(V1_NO_TIPS);
    expect(heading().textContent).toBe("Practice 1 — 75/100");
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain(V1_NO_TIPS.questions[1].reasonText);
    expect(screen.queryByRole("link", { name: /See tip/ })).toBeNull();
    expect(screen.queryByRole("region", { name: "Tips" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next tip" })).toBeNull();
    expect(cards()).toHaveLength(0);
    expect(slot("correct-count")!.textContent).toBe("3 of 4 correct");
  });

  it("legacy Result without Tips at 80: the ≥ 80 variant, still no Tips section", () => {
    view(V1_NO_TIPS_80);
    expect(heading().textContent).toBe("Practice 1 — 80/100");
    expect(badge().dataset.variant).toBe("pass");
    expect(badge().dataset.glow).toBe("true");
    expect(slot("tips")).toBeNull();
    expect(screen.queryByRole("link", { name: /See tip/ })).toBeNull();
  });

  it("a question without a tip key at all is a question without a Tip", () => {
    const questions = PRACTICE_64.questions.map((question, i) => {
      if (i !== 1) return question;
      const copy: Partial<typeof question> = { ...question };
      delete copy.tip;
      return copy as typeof question;
    });
    view({ ...PRACTICE_64, questions });
    expect(cards().map((card) => card.id)).toEqual(["tip-1", "tip-3", "tip-4"]);
    expect(within(rows()[0]).queryByRole("link")).toBeNull();
    expect(within(rows()[1]).getByRole("link", { name: /See tip/ })).toBeTruthy();
  });

  it("floor at 0: the deduction is the points actually taken", () => {
    view(FLOORED_0);
    expect(heading().textContent).toBe("Practice 1 — 0/100");
    expect(slot("deduction")!.textContent).toBe("Hint ×3 −10");
  });

  it("a kind that is neither practice nor Test is shown by its id", () => {
    view(PRACTICE_85, { itemId: "UA", item: { kind: "final", number: 1 } as unknown as ResultsViewProps["item"] });
    expect(heading().textContent).toBe("UA — 85/100");
    expect(slot("level-label")!.textContent).toBe("UA");
    expect(slot("results")!.dataset.kind).toBe("unknown");
  });

  it("partial Tips: cards only for questions with a Tip, counted by card, See tip only where there is one", async () => {
    const user = userEvent.setup();
    view(PARTIAL_TIPS);
    expect(cards().map((card) => card.id)).toEqual(["tip-1", "tip-3"]);
    expect(position().textContent).toBe("Tip 1 of 2");
    expect(rows()).toHaveLength(2);
    expect(within(rows()[0]).queryByRole("link")).toBeNull();
    await user.click(within(rows()[1]).getByRole("link", { name: /See tip/ }));
    expect(position().textContent).toBe("Tip 2 of 2");
    expect(current().querySelector("#tip-3")).not.toBeNull();
  });

  it("unknown item: its id as the label and in the heading, variant from the score", () => {
    view(PRACTICE_85, { itemId: "L09-P9", item: null, level: null });
    expect(heading().textContent).toBe("L09-P9 — 85/100");
    expect(slot("level-label")!.textContent).toBe("L09-P9");
    expect(badge().dataset.variant).toBe("pass");
    expect(cards()).toHaveLength(4);
    expect(cards()[0].textContent).not.toContain("Level");
  });

  it("no time: the time fact is not shown", () => {
    view(PRACTICE_85, { durationSeconds: null });
    expect(slot("time")).toBeNull();
    expect(screen.queryByText("time")).toBeNull();
    expect(slot("correct-count")!.textContent).toBe("4 of 4 correct");
  });

  it("shows a long attempt as h:mm:ss", () => {
    view(PRACTICE_85, { durationSeconds: 3725 });
    expect(slot("time")!.textContent).toBe("1:02:05 time");
  });
});

describe("Tips Card", () => {
  it("has the level tag, the question and its status in text, and Indonesian title and body", () => {
    view(PRACTICE_64);
    const [first, second] = cards();
    expect(first.textContent).toContain("Level 1");
    expect(first.textContent).toContain("✓ Soal 1 · Correct");
    expect(second.textContent).toContain("✗ Soal 2 · Wrong");
    expect(within(first).getByText("✓").getAttribute("aria-hidden")).toBe("true");
    expect(within(second).getByText("✗").getAttribute("aria-hidden")).toBe("true");
    const title = within(first).getByRole("heading", { level: 3 });
    expect(title.textContent).toBe(PRACTICE_64.questions[0].tip!.title);
    expect(title.getAttribute("lang")).toBe("id");
    expect(within(first).getByText(PRACTICE_64.questions[0].tip!.body).getAttribute("lang")).toBe("id");
    expect(first.hasAttribute("tabindex")).toBe(false);
    expect(first.querySelector("[tabindex]")).toBeNull();
  });

  it("splits each shortcut on + into Kbd keys", () => {
    view(PRACTICE_85);
    const shortcut = cards()[2].querySelector<HTMLElement>('[data-shortcut="Ctrl+Shift+%"]')!;
    const keys = Array.from(shortcut.querySelectorAll("kbd"));
    expect(keys.map((key) => key.textContent)).toEqual(["Ctrl", "Shift", "%"]);
    expect(shortcut.textContent).toBe("Ctrl+Shift+%");
    expect(keys[0].className).toContain("text-[15px]");
    expect(keys[0].getAttribute("lang")).toBe("en");
    const single = cards()[1].querySelector<HTMLElement>('[data-shortcut="F4"]')!;
    expect(Array.from(single.querySelectorAll("kbd")).map((key) => key.textContent)).toEqual(["F4"]);
    expect(single.textContent).toBe("F4");
    // Two shortcuts on one Tip stay two groups.
    expect(cards()[3].querySelectorAll("[data-shortcut]")).toHaveLength(2);
  });
});

describe("focus", () => {
  afterEach(() => {
    window.history.replaceState(null, "", window.location.pathname);
  });

  it("moves to the <h1> after mount in live mode, without scrolling", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    view(PRACTICE_85);
    expect(heading().getAttribute("tabindex")).toBe("-1");
    expect(heading().id).toBe("results-heading");
    expect(document.activeElement).toBe(heading());
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    focus.mockRestore();
  });

  it("stays where it was in static mode", () => {
    view(PRACTICE_64, { mode: "static" });
    expect(document.activeElement).not.toBe(heading());
  });

  it("is left alone when the URL has a fragment", () => {
    window.history.replaceState(null, "", "#tip-2");
    view(PRACTICE_64);
    expect(document.activeElement).toBe(document.body);
  });

  it("is left alone when the user already focused something inside the page, moved from outside it", () => {
    const outside = document.body.appendChild(document.createElement("button"));
    const main = document.body.appendChild(document.createElement("main"));
    const inside = main.appendChild(document.createElement("button"));
    const container = main.appendChild(document.createElement("div"));
    try {
      inside.focus();
      const first = render(<ResultsView itemId="L01-P1" item={PRACTICE} level={LEVEL} result={PRACTICE_85} durationSeconds={1} mode="live" />, { container });
      expect(document.activeElement).toBe(inside);
      first.unmount();
      outside.focus();
      const second = main.appendChild(document.createElement("div"));
      render(<ResultsView itemId="L01-P1" item={PRACTICE} level={LEVEL} result={PRACTICE_85} durationSeconds={1} mode="live" />, { container: second });
      expect(document.activeElement).toBe(heading());
    } finally {
      outside.remove();
      main.remove();
    }
  });

  it("focuses any heading by id (the failed-load heading too)", () => {
    render(
      <>
        <h1 id="results-heading" tabIndex={-1}>
          Results
        </h1>
        <ResultsFocus targetId="results-heading" />
      </>,
    );
    expect(document.activeElement).toBe(heading());
  });
});

describe("Tips Carousel", () => {
  it("is a labelled, focusable carousel region of slides", () => {
    view(PRACTICE_85);
    expect(region().getAttribute("aria-roledescription")).toBe("carousel");
    expect(region().getAttribute("tabindex")).toBe("0");
    const slides = within(region()).getAllByRole("group");
    expect(slides).toHaveLength(4);
    expect(slides.every((slide) => slide.getAttribute("aria-roledescription") === "slide")).toBe(true);
    expect(position().getAttribute("aria-live")).toBe("polite");
  });

  it("Next moves one card and announces it; Prev is aria-disabled at the start", async () => {
    const user = userEvent.setup();
    view(PRACTICE_85);
    expect(prev().getAttribute("aria-disabled")).toBe("true");
    expect(next().getAttribute("aria-disabled")).toBe("false");
    await user.click(prev());
    expect(position().textContent).toBe("Tip 1 of 4");
    await user.click(next());
    expect(position().textContent).toBe("Tip 2 of 4");
    expect(current().querySelector("#tip-2")).not.toBeNull();
    expect(prev().getAttribute("aria-disabled")).toBe("false");
    await user.click(prev());
    expect(position().textContent).toBe("Tip 1 of 4");
  });

  it("Next at the last card is aria-disabled, keeps focus and does not move", async () => {
    const user = userEvent.setup();
    view(PRACTICE_85);
    await user.click(next());
    await user.click(next());
    await user.click(next());
    expect(position().textContent).toBe("Tip 4 of 4");
    expect(next().getAttribute("aria-disabled")).toBe("true");
    expect(next().hasAttribute("disabled")).toBe(false);
    expect(document.activeElement).toBe(next());
    await user.click(next());
    expect(position().textContent).toBe("Tip 4 of 4");
    expect(document.activeElement).toBe(next());
  });

  it("ArrowRight and ArrowLeft on the focused region move one card", async () => {
    const user = userEvent.setup();
    view(PRACTICE_85);
    region().focus();
    await user.keyboard("{ArrowRight}");
    expect(position().textContent).toBe("Tip 2 of 4");
    await user.keyboard("{ArrowRight}");
    expect(position().textContent).toBe("Tip 3 of 4");
    await user.keyboard("{ArrowLeft}");
    expect(position().textContent).toBe("Tip 2 of 4");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(position().textContent).toBe("Tip 1 of 4");
    expect(document.activeElement).toBe(region());
  });

  it("ignores other keys", () => {
    view(PRACTICE_85);
    fireEvent.keyDown(region(), { key: "ArrowDown" });
    fireEvent.keyDown(region(), { key: "End" });
    expect(position().textContent).toBe("Tip 1 of 4");
  });

  it("See tip shows that question's card and focuses the region", async () => {
    const user = userEvent.setup();
    view(PRACTICE_64);
    await user.click(within(rows()[1]).getByRole("link", { name: /See tip/ }));
    expect(position().textContent).toBe("Tip 3 of 4");
    expect(current().querySelector("#tip-3")).not.toBeNull();
    expect(document.activeElement).toBe(current());
    expect(current().getAttribute("tabindex")).toBe("-1");
    expect(current().getAttribute("aria-label")).toBe("Tip 3 of 4");
    await user.click(within(rows()[0]).getByRole("link", { name: /See tip/ }));
    expect(position().textContent).toBe("Tip 2 of 4");
    expect(document.activeElement).toBe(current());
    // Arrows on the focused card move one card, and focus follows.
    await user.keyboard("{ArrowRight}");
    expect(position().textContent).toBe("Tip 3 of 4");
    expect(document.activeElement).toBe(current());
  });

  it("marks the current card, and only it", async () => {
    const user = userEvent.setup();
    view(PRACTICE_85);
    const marked = () => cards().map((card) => card.className.includes("border-primary"));
    expect(marked()).toEqual([true, false, false, false]);
    expect(current().getAttribute("aria-current")).toBe("true");
    await user.click(next());
    expect(marked()).toEqual([false, true, false, false]);
    expect(document.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
  });

  it("starts again at the first card when the Tips change", async () => {
    const user = userEvent.setup();
    const { rerender } = view(PRACTICE_85);
    await user.click(next());
    await user.click(next());
    expect(position().textContent).toBe("Tip 3 of 4");
    rerender(<ResultsView itemId="L01-P1" item={PRACTICE} level={LEVEL} result={PARTIAL_TIPS} durationSeconds={408} mode="live" />);
    expect(position().textContent).toBe("Tip 1 of 2");
    expect(current().querySelector("#tip-1")).not.toBeNull();
  });

  it("See tip is a target of at least 24px", () => {
    view(PRACTICE_64);
    const link = within(rows()[0]).getByRole("link", { name: /See tip/ });
    expect(link.className).toContain("min-h-6");
    expect(link.className).toContain("min-w-6");
  });
});

describe("Tips Card keys", () => {
  it("renders a repeated shortcut without a duplicate-key warning", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<TipsCard tip={{ id: "x", title: "T", body: "B", shortcuts: ["F4", "F4"] }} questionNumber={1} correct levelNumber={1} />);
    expect(document.querySelectorAll('[data-shortcut="F4"]')).toHaveLength(2);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});

/**
 * jsdom has no layout: these tests give the track and its cards a geometry.
 * Cards are 286px apart from 2px; the track is `clientWidth` wide of
 * `scrollWidth`, so the last cards share the end position.
 */
describe("Tips Carousel scrolling", () => {
  const geometry = { scrollWidth: 1180, clientWidth: 600, initialScrollLeft: 0 };
  const scrollLefts = new WeakMap<Element, number>();
  const saved: [object, string, PropertyDescriptor | undefined][] = [];
  const define = (proto: object, name: string, descriptor: PropertyDescriptor) => {
    saved.push([proto, name, Object.getOwnPropertyDescriptor(proto, name)]);
    Object.defineProperty(proto, name, { configurable: true, ...descriptor });
  };
  const isTrack = (element: Element) => element.getAttribute("aria-roledescription") === "carousel";
  let scrollTo: ReturnType<typeof vi.spyOn>;
  let scrollIntoView: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    Object.assign(geometry, { scrollWidth: 1180, clientWidth: 600, initialScrollLeft: 0 });
    define(HTMLElement.prototype, "offsetLeft", {
      get(this: HTMLElement) {
        if (this.getAttribute("aria-roledescription") !== "slide") return 0;
        return 2 + 286 * Array.from(this.parentElement!.children).indexOf(this);
      },
    });
    define(Element.prototype, "scrollWidth", {
      get(this: Element) {
        return isTrack(this) ? geometry.scrollWidth : 0;
      },
    });
    define(Element.prototype, "clientWidth", {
      get(this: Element) {
        return isTrack(this) ? geometry.clientWidth : 0;
      },
    });
    define(Element.prototype, "scrollLeft", {
      get(this: Element) {
        return scrollLefts.get(this) ?? (isTrack(this) ? geometry.initialScrollLeft : 0);
      },
      set(this: Element, value: number) {
        scrollLefts.set(this, value);
      },
    });
    scrollTo = vi.spyOn(Element.prototype, "scrollTo").mockImplementation(() => {});
    scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    scrollTo.mockRestore();
    scrollIntoView.mockRestore();
    for (const [proto, name, descriptor] of saved.splice(0).reverse()) {
      if (descriptor) Object.defineProperty(proto, name, descriptor);
      else delete (proto as Record<string, unknown>)[name];
    }
  });

  /** The user scrolled the track to `left` and the browser says scrolling ended. */
  const scrolledTo = (left: number) =>
    act(() => {
      region().scrollLeft = left;
      region().dispatchEvent(new Event("scrollend"));
    });

  it("Next, Prev and ArrowRight scroll the track to the card's left edge, capped at the end", () => {
    view(PRACTICE_85);
    fireEvent.click(next());
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 286 });
    expect(scrollTo.mock.contexts.at(-1)).toBe(region());
    fireEvent.keyDown(region(), { key: "ArrowRight" });
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 572 });
    fireEvent.click(next());
    // The fourth card's edge (858) is past the end of the track (1180 − 600).
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 580 });
    expect(position().textContent).toBe("Tip 4 of 4");
    fireEvent.click(prev());
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 572 });
    const calls = scrollTo.mock.calls.length;
    fireEvent.click(prev());
    fireEvent.click(prev());
    fireEvent.click(prev());
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0 });
    expect(scrollTo.mock.calls.length).toBe(calls + 2);
  });

  it("steps the index even when the track cannot scroll", () => {
    Object.assign(geometry, { scrollWidth: 600, clientWidth: 600 });
    view(PRACTICE_85);
    fireEvent.click(next());
    fireEvent.click(next());
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0 });
    expect(position().textContent).toBe("Tip 3 of 4");
    expect(current().querySelector("#tip-3")).not.toBeNull();
  });

  it("ArrowRight and ArrowLeft are handled (default prevented); other keys are not", () => {
    view(PRACTICE_85);
    expect(fireEvent.keyDown(region(), { key: "ArrowRight" })).toBe(false);
    expect(fireEvent.keyDown(region(), { key: "ArrowLeft" })).toBe(false);
    expect(fireEvent.keyDown(region(), { key: "ArrowDown" })).toBe(true);
    expect(fireEvent.keyDown(region(), { key: "Tab" })).toBe(true);
  });

  it("See tip prevents the jump, brings the track into view and scrolls it to that card", () => {
    view(PRACTICE_64);
    const link = within(rows()[1]).getByRole("link", { name: /See tip/ });
    expect(fireEvent.click(link)).toBe(false);
    expect(scrollIntoView.mock.contexts).toEqual([region()]);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 572 });
    expect(position().textContent).toBe("Tip 3 of 4");
  });

  it("See tip leaves modified and non-primary clicks to the browser", () => {
    view(PRACTICE_64);
    const link = within(rows()[1]).getByRole("link", { name: /See tip/ });
    for (const init of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      expect(fireEvent.click(link, init)).toBe(true);
    }
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
    expect(position().textContent).toBe("Tip 1 of 4");
  });

  it("a user scroll updates Tip k of n, and Next continues from there", () => {
    view(PRACTICE_85);
    scrolledTo(290);
    expect(position().textContent).toBe("Tip 2 of 4");
    expect(current().querySelector("#tip-2")).not.toBeNull();
    expect(scrollTo).not.toHaveBeenCalled();
    fireEvent.click(next());
    expect(position().textContent).toBe("Tip 3 of 4");
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 572 });
  });

  it("reads the card after scroll events settle, where scrollend does not fire", () => {
    vi.useFakeTimers();
    view(PRACTICE_85);
    region().scrollLeft = 150;
    fireEvent.scroll(region());
    act(() => void vi.advanceTimersByTime(SCROLL_SETTLE_MS - 1));
    region().scrollLeft = 570;
    fireEvent.scroll(region());
    act(() => void vi.advanceTimersByTime(SCROLL_SETTLE_MS - 1));
    expect(position().textContent).toBe("Tip 1 of 4");
    act(() => void vi.advanceTimersByTime(1));
    expect(position().textContent).toBe("Tip 3 of 4");
  });

  it("at the end of the track, picks the first of the cards sharing it, and keeps the current one if it is among them", () => {
    // End at 350: cards 3 (572) and 4 (858) both sit there.
    Object.assign(geometry, { scrollWidth: 1150, clientWidth: 800 });
    view(PRACTICE_85);
    scrolledTo(350);
    expect(position().textContent).toBe("Tip 3 of 4");
    fireEvent.click(next());
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 350 });
    expect(position().textContent).toBe("Tip 4 of 4");
    scrolledTo(350);
    expect(position().textContent).toBe("Tip 4 of 4");
    scrolledTo(0);
    expect(position().textContent).toBe("Tip 1 of 4");
  });

  it("reads the card once on mount (a #tip-N anchor scrolled the track before hydration)", () => {
    geometry.initialScrollLeft = 286;
    view(PRACTICE_85);
    expect(position().textContent).toBe("Tip 2 of 4");
  });

  it("puts the current card back at its position when the track is resized", () => {
    const observed: Element[] = [];
    let resized: () => void = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe(element: Element) {
          observed.push(element);
        }
        disconnect() {
          observed.length = 0;
        }
      },
    );
    const { unmount } = view(PRACTICE_85);
    expect(observed).toEqual([region()]);
    fireEvent.click(next());
    fireEvent.click(next());
    fireEvent.click(next());
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 580 });
    geometry.clientWidth = 900;
    act(() => resized());
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 280 });
    expect(position().textContent).toBe("Tip 4 of 4");
    unmount();
    expect(observed).toEqual([]);
  });
});
