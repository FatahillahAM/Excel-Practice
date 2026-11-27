// @vitest-environment jsdom
import "@/test/dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { P3_MATERI } from "@/content/levels/01-fondasi/practice-3";
import { MateriSheet } from "./materi-sheet";

describe("MateriSheet (5.7)", () => {
  it("opens the L01-P3 cards in a labelled dialog, Indonesian text with English code and keys", async () => {
    render(<MateriSheet itemLabel="Practice 3" cards={P3_MATERI} />);
    await userEvent.click(screen.getByRole("button", { name: "Materi · 3 kartu, Practice 3" }));
    const sheet = screen.getByRole("dialog", { name: "Materi Practice 3" });
    const cards = within(sheet).getAllByRole("article");
    expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual([
      "1.SORT: urut naik atau turun",
      "2.SORTBY: urut berdasarkan kolom lain",
      "3.Spill: cukup satu sel",
    ]);
    for (const card of cards) expect(card.getAttribute("lang")).toBe("id");
    const codes = sheet.querySelectorAll("code");
    expect(codes.length).toBeGreaterThan(0);
    for (const code of codes) expect(code.getAttribute("lang")).toBe("en");
    const keys = sheet.querySelectorAll("kbd");
    expect([...keys].map((key) => key.textContent)).toContain("Delete");
    for (const key of keys) expect(key.getAttribute("lang")).toBe("en");
    expect(within(sheet).getByText("=SORT(C2:C9,1,1)")).toBeTruthy();
  });

  it("closes with Escape and returns focus to the trigger", async () => {
    render(<MateriSheet itemLabel="Practice 3" cards={P3_MATERI} />);
    const trigger = screen.getByRole("button", { name: /Materi/ });
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("renders nothing without cards", () => {
    const { container } = render(<MateriSheet itemLabel="Test" cards={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
