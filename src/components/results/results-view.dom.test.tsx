// @vitest-environment jsdom
import "@/test/dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  PARTIAL_TIPS,
  PRACTICE_64,
  PRACTICE_85,
  RESULT_FIXTURES,
  SCORE_79,
  SCORE_80,
  TEST_72,
  TEST_88,
  V1_NO_TIPS,
} from "@/core/grading/__fixtures__/results";
import { resultSchema, type Result } from "@/core/grading/result";
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
    expect(Object.values(RESULT_FIXTURES).map((fixture) => fixture.score)).toEqual([85, 64, 80, 79, 88, 72, 75, 50]);
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
    expect(badge().className).toContain("bg-primary");
    expect(badge().getAttribute("aria-hidden")).toBe("true");
    expect(badge().textContent).toBe("85/100");
    expect(slot("deduction")!.textContent).toBe("Hint ×3−15");
    expect(within(slot("deduction")!).getByText("−15").className).toContain("text-warning");
    expect(slot("level-label")!.textContent).toBe("Level 1 — Fondasi");
    expect(within(slot("level-label")!).getByText("Fondasi").getAttribute("lang")).toBe("id");
    expect(slot("correct-count")!.textContent).toBe("4 of 4 correct");
    expect(slot("time")!.textContent).toBe("06:48 time");
    const allCorrect = screen.getByText("Semua benar!");
    expect(allCorrect.getAttribute("lang")).toBe("id");
    expect(allCorrect.className).toContain("text-success");
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
    expect(badge().className).toContain("bg-muted");
    expect(badge().className).toContain("--input-border");
    expect(badge().className).not.toContain("glow");
    expect(badge().className).not.toContain("destructive");
    expect(slot("deduction")!.textContent).toBe("No hints");
    expect(screen.getByRole("heading", { level: 2, name: /Wrong answers/ }).textContent).toBe("Wrong answers2");
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
    expect(badge().className).toContain("bg-muted");
    expect(slot("deduction")!.textContent).toBe("Hint ×3−15");
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
  it("moves to the <h1> after mount in live mode", () => {
    view(PRACTICE_85);
    expect(heading().getAttribute("tabindex")).toBe("-1");
    expect(heading().id).toBe("results-heading");
    expect(document.activeElement).toBe(heading());
  });

  it("stays where it was in static mode", () => {
    view(PRACTICE_64, { mode: "static" });
    expect(document.activeElement).not.toBe(heading());
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
    expect(document.activeElement).toBe(region());
    await user.click(within(rows()[0]).getByRole("link", { name: /See tip/ }));
    expect(position().textContent).toBe("Tip 2 of 4");
    expect(document.activeElement).toBe(region());
  });
});
