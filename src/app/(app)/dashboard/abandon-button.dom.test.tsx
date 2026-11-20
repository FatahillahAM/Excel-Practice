// @vitest-environment jsdom
import "@/test/dom";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ abandonAttempt: vi.fn() }));
vi.mock("next/navigation", () => ({
  unstable_rethrow: (error: unknown) => {
    if (String((error as { digest?: unknown } | null)?.digest ?? "").startsWith("NEXT_REDIRECT")) throw error;
  },
}));
vi.mock("./abandon-actions", () => ({ abandonAttempt: mocks.abandonAttempt }));

import { attemptMessages } from "@/messages/id";
import { AbandonButton } from "./abandon-button";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";

function Page({ card = true }: { card?: boolean }) {
  return (
    <>
      <h1 id="dash-title" tabIndex={-1}>
        Dashboard
      </h1>
      {card && <AbandonButton attemptId={ID} attemptTitle="Level 1 · Practice 1" focusAfterId="dash-title" />}
    </>
  );
}

const dialog = () => screen.getByRole("alertdialog");
const trigger = () => screen.getByRole("button", { name: "Abandon" });
const confirm = () => within(dialog()).getByRole("button", { name: /^Abandon/ });
const slot = () => within(dialog()).getByRole("alert");

afterEach(() => {
  mocks.abandonAttempt.mockReset();
});

describe("Abandon dialog in the DOM", () => {
  it("opens as an alertdialog naming the attempt; Esc closes with no change and focus returns to Abandon", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(trigger());
    expect(dialog().getAttribute("aria-labelledby")).toBeTruthy();
    expect(within(dialog()).getByText("Level 1 · Practice 1")).toBeTruthy();
    expect(slot().textContent).toBe("");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(mocks.abandonAttempt).not.toHaveBeenCalled();
  });

  it("focus is trapped: Tab cycles between Cancel and Abandon inside the dialog", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(trigger());
    const inside = () => dialog().contains(document.activeElement);
    expect(inside()).toBe(true);
    for (let i = 0; i < 4; i++) {
      await user.tab();
      expect(inside()).toBe(true);
    }
    await user.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(trigger());
  });

  it("pending: Abandoning…, both buttons disabled, Esc does not close; an error lands in the alert slot", async () => {
    let resolve!: (s: unknown) => void;
    mocks.abandonAttempt.mockReturnValue(new Promise((r) => (resolve = r)));
    const user = userEvent.setup();
    render(<Page />);
    await user.click(trigger());
    await user.click(confirm());
    expect(confirm().textContent).toBe("Abandoning…");
    expect((confirm() as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog()).getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect((mocks.abandonAttempt.mock.calls[0][1] as FormData).get("attemptId")).toBe(ID);

    await act(async () => resolve({ status: "error" }));
    expect(slot().textContent).toBe(attemptMessages.abandonFailed);
    expect(confirm().getAttribute("aria-describedby")).toBe(slot().id);
    expect(confirm().textContent).toBe("Abandon");
  });

  it("a stale error is hidden when the dialog is opened again, until the next try", async () => {
    mocks.abandonAttempt.mockResolvedValue({ status: "error" });
    const user = userEvent.setup();
    render(<Page />);
    await user.click(trigger());
    await user.click(confirm());
    expect(slot().textContent).toBe(attemptMessages.abandonFailed);
    await user.click(within(dialog()).getByRole("button", { name: "Cancel" }));

    await user.click(trigger());
    expect(slot().textContent).toBe("");
    await user.click(confirm());
    expect(slot().textContent).toBe(attemptMessages.abandonFailed);
  });

  it("a thrown transport error is the same message in the slot", async () => {
    mocks.abandonAttempt.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    render(<Page />);
    await user.click(trigger());
    await user.click(confirm());
    expect(slot().textContent).toBe(attemptMessages.abandonFailed);
  });

  it("done: the dialog closes and focus moves to the page title, also when the card unmounts", async () => {
    mocks.abandonAttempt.mockResolvedValue({ status: "done" });
    const user = userEvent.setup();
    const { rerender } = render(<Page />);
    await user.click(trigger());
    await user.click(confirm());
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Dashboard" }));

    rerender(<Page card={false} />);
    await act(async () => new Promise((r) => setTimeout(r, 0)));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Dashboard" }));
  });
});
