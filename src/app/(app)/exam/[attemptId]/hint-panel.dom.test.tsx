// @vitest-environment jsdom
import "@/test/dom";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() },
  revealHint: vi.fn(),
  retryGrading: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  unstable_rethrow: (error: unknown) => {
    if (String((error as { digest?: unknown } | null)?.digest ?? "").startsWith("NEXT_REDIRECT")) throw error;
  },
}));
vi.mock("./hint-actions", () => ({ revealHint: mocks.revealHint }));
vi.mock("./retry-actions", () => ({ retryGrading: mocks.retryGrading }));

import type { HintState } from "@/core/services/attempts";
import { hintMessages } from "@/messages/id";
import { ExamStatus } from "./exam-status";
import { HintPanel } from "./hint-panel";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const text = (question: number, index: number) => `Petunjuk ${index + 1} untuk soal ${question}.`;

const STATE: HintState = {
  quota: 3,
  used: 0,
  questions: [1, 2, 3, 4].map((number) => ({ number, hintCount: 3 })),
  revealed: [],
};

/** The action's answer for a form: the next hint of that soal, with `used` counted here like the database does. */
function serverLike(start = 0) {
  let used = start;
  return async (_previous: unknown, formData: FormData) => {
    const question = Number(formData.get("question"));
    const index = Number(formData.get("hintIndex"));
    if (used >= 3) return { status: "quota_used", used, quota: 3 };
    used += 1;
    return { status: "revealed", reveal: { question, index, text: text(question, index) }, used, quota: 3 };
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function show(initial: HintState = STATE) {
  return render(<HintPanel attemptId={ID} initial={initial} beside={<div>Dropzone here</div>} />);
}

/** The accessible name as the markup sets it: `aria-label`, else the text. */
const nameOf = (element: Element | null) => element?.getAttribute("aria-label") ?? element?.textContent ?? "";

const hintButton = () => screen.getByRole("button", { name: /^(Hint for Soal|No hints left|All hints for)/ });

async function pickSoal(user: ReturnType<typeof userEvent.setup>, n: number) {
  await user.click(screen.getByRole("combobox", { name: "Hint for" }));
  await user.click(await screen.findByRole("option", { name: `Soal ${n}` }));
}

beforeEach(() => {
  mocks.revealHint.mockImplementation(serverLike());
});

afterEach(() => {
  mocks.revealHint.mockReset();
  mocks.router.refresh.mockReset();
});

const formOf = (call: number) => Object.fromEntries((mocks.revealHint.mock.calls[call][1] as FormData).entries());

describe("HintPanel", () => {
  it("(a) Soal 2, press: posts question 2 / hintIndex 0, shows 'Hint 1 · Soal 2' focused, then '2 left'", async () => {
    const user = userEvent.setup();
    show();
    expect(nameOf(hintButton())).toBe("Hint for Soal 1, minus 5 points, 3 left");
    await pickSoal(user, 2);
    expect(nameOf(hintButton())).toBe("Hint for Soal 2, minus 5 points, 3 left");
    await user.click(hintButton());

    expect(mocks.revealHint).toHaveBeenCalledTimes(1);
    expect(formOf(0)).toEqual({ attemptId: ID, question: "2", hintIndex: "0" });
    const block = await screen.findByText(text(2, 0));
    const container = block.closest("[data-hint]") as HTMLElement;
    expect((container).getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(container);
    expect((within(container).getByText(/Hint 1 ·/)).textContent).toContain("Hint 1 · Soal 2");
    expect(within(container).getByText("−5")).toBeTruthy();
    expect((block).getAttribute("lang")).toBe("id");
    expect(nameOf(hintButton())).toBe("Hint for Soal 2, minus 5 points, 2 left");
    expect((hintButton()).textContent).toContain("2 left");
    expect((screen.getByRole("status")).textContent).toContain("2 hints left");

    // The next press for the same soal asks for its next hint.
    await user.click(hintButton());
    expect(formOf(1)).toMatchObject({ question: "2", hintIndex: "1" });
    expect(await screen.findByText(text(2, 1))).toBeTruthy();
  });

  it("(b) three reveals: 'No hints left', aria-disabled, focus stays on the button, more presses post nothing", async () => {
    const user = userEvent.setup();
    show();
    await user.click(hintButton());
    await screen.findByText(text(1, 0));
    await pickSoal(user, 3);
    await user.click(hintButton());
    await screen.findByText(text(3, 0));
    await user.click(hintButton());
    await screen.findByText(text(3, 1));

    const button = hintButton();
    expect(nameOf(button)).toBe("No hints left");
    expect((button).textContent).toContain("No hints left");
    expect((button).getAttribute("aria-disabled")).toBe("true");
    await user.click(button);
    expect(document.activeElement).toBe(button);
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(button);
    expect(mocks.revealHint).toHaveBeenCalledTimes(3);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("(c) a double click while pending posts once; the button is aria-disabled meanwhile", async () => {
    const user = userEvent.setup();
    const answer = deferred<unknown>();
    mocks.revealHint.mockImplementation(() => answer.promise);
    show();
    await user.dblClick(hintButton());
    await user.click(hintButton());
    expect(mocks.revealHint).toHaveBeenCalledTimes(1);
    expect((hintButton()).getAttribute("aria-disabled")).toBe("true");
    expect((hintButton()).getAttribute("aria-busy")).toBe("true");
    await act(async () => {
      answer.resolve({ status: "revealed", reveal: { question: 1, index: 0, text: text(1, 0) }, used: 1, quota: 3 });
    });
    expect(await screen.findByText(text(1, 0))).toBeTruthy();
    expect((hintButton()).getAttribute("aria-disabled")).toBeNull();
    expect(mocks.revealHint).toHaveBeenCalledTimes(1);
  });

  it("(d) already: the hint is not listed twice and costs nothing more", async () => {
    const user = userEvent.setup();
    const initial = { ...STATE, used: 1, revealed: [{ question: 1, index: 0, text: text(1, 0) }] };
    mocks.revealHint.mockResolvedValue({ status: "already", reveal: { question: 1, index: 0, text: text(1, 0) }, used: 1, quota: 3 });
    show(initial);
    await user.click(hintButton());
    expect(mocks.revealHint).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(text(1, 0))).toHaveLength(1);
    expect((hintButton()).textContent).toContain("2 left");
    expect(document.activeElement).toBe(screen.getByText(text(1, 0)).closest("[data-hint]"));
  });

  it("(e) a rehydrated state with 2 reveals renders both blocks in order and '1 left'", () => {
    show({
      ...STATE,
      used: 2,
      revealed: [
        { question: 3, index: 0, text: text(3, 0) },
        { question: 1, index: 0, text: text(1, 0) },
      ],
    });
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      `Hint 1 · Soal 3−5${text(3, 0)}`,
      `Hint 1 · Soal 1−5${text(1, 0)}`,
    ]);
    expect(nameOf(hintButton())).toBe("Hint for Soal 1, minus 5 points, 1 left");
    // Soal 1 already showed hint 1: the next press asks for index 1.
    expect((document.querySelector('input[name="hintIndex"]') as HTMLInputElement).value).toBe("1");
  });

  it("(f) error: the network alert (lang id), the button usable again and focused", async () => {
    const user = userEvent.setup();
    mocks.revealHint.mockResolvedValue({ status: "error" });
    show();
    await user.click(hintButton());
    const alert = await screen.findByRole("alert");
    expect((alert).textContent).toContain(hintMessages.failed);
    expect((alert).getAttribute("lang")).toBe("id");
    expect((hintButton()).getAttribute("aria-disabled")).toBeNull();
    expect(document.activeElement).toBe(hintButton());
    // A transport failure (the action throws) is the same message.
    mocks.revealHint.mockRejectedValue(new TypeError("Failed to fetch"));
    await user.click(hintButton());
    expect((await screen.findByRole("alert")).textContent).toContain(hintMessages.failed);
    expect(mocks.revealHint).toHaveBeenCalledTimes(2);
  });

  it("(g) not_open: the 'no longer running' alert", async () => {
    const user = userEvent.setup();
    mocks.revealHint.mockResolvedValue({ status: "not_open" });
    show();
    await user.click(hintButton());
    expect((await screen.findByRole("alert")).textContent).toContain(hintMessages.notOpen);
    expect(document.activeElement).toBe(hintButton());
  });

  it("quota_used from the server (another tab): 'No hints left'", async () => {
    const user = userEvent.setup();
    mocks.revealHint.mockResolvedValue({ status: "quota_used", used: 3, quota: 3 });
    show();
    await user.click(hintButton());
    expect((await screen.findByRole("button", { name: "No hints left" })).getAttribute("aria-disabled")).toBe("true");
  });

  it("a soal whose hints are all shown: aria-disabled 'All hints for Soal N shown'; out_of_order refreshes", async () => {
    const user = userEvent.setup();
    show({
      ...STATE,
      questions: [
        { number: 1, hintCount: 1 },
        { number: 2, hintCount: 3 },
      ],
      used: 1,
      revealed: [{ question: 1, index: 0, text: text(1, 0) }],
    });
    expect(nameOf(hintButton())).toBe("All hints for Soal 1 shown");
    expect((hintButton()).getAttribute("aria-disabled")).toBe("true");
    await user.click(hintButton());
    expect(mocks.revealHint).not.toHaveBeenCalled();

    await pickSoal(user, 2);
    mocks.revealHint.mockResolvedValue({ status: "out_of_order", used: 2, quota: 3 });
    await user.click(hintButton());
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
  });

  it("no_more_hints from the server: that soal's button turns aria-disabled", async () => {
    const user = userEvent.setup();
    mocks.revealHint.mockResolvedValue({ status: "no_more_hints", used: 0, quota: 3 });
    show();
    await user.click(hintButton());
    expect(nameOf(await screen.findByRole("button", { name: "All hints for Soal 1 shown" }))).toBe("All hints for Soal 1 shown");
    expect(hintButton().getAttribute("aria-disabled")).toBe("true");
  });

  it("a new server state (refresh) replaces the local one", () => {
    const { rerender } = show();
    rerender(
      <HintPanel
        attemptId={ID}
        initial={{ ...STATE, used: 1, revealed: [{ question: 4, index: 0, text: text(4, 0) }] }}
        beside={<div>Dropzone here</div>}
      />,
    );
    expect(screen.getByText(text(4, 0))).toBeTruthy();
    expect((hintButton()).textContent).toContain("2 left");
  });

  it("puts the Dropzone beside the hint group", () => {
    show();
    expect(screen.getByText("Dropzone here")).toBeTruthy();
  });
});

describe("ExamStatus hint group", () => {
  beforeEach(() => {
    // The poll never answers: these tests look at the first render only.
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const exam = (hints: HintState | null, status: "open" | "received" = "open") =>
    render(
      <ExamStatus
        attemptId={ID}
        itemLabel="Practice 1"
        initialStatus={status}
        initialElapsed={60}
        initialReceivedSeconds={status === "open" ? null : 1}
        hints={hints}
      />,
    );

  it("(h) quota 0: no hint group, the Dropzone alone", () => {
    exam({ ...STATE, quota: 0 });
    expect(screen.queryByRole("combobox", { name: "Hint for" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Hint/ })).toBeNull();
    expect(screen.getByText("Upload file (.xlsm)")).toBeTruthy();
  });

  it("no hint state (the read failed): no hint group, the Dropzone alone", () => {
    exam(null);
    expect(screen.queryByRole("combobox", { name: "Hint for" })).toBeNull();
    expect(screen.getByText("Upload file (.xlsm)")).toBeTruthy();
  });

  it("open with quota: the hint group beside the Dropzone", () => {
    exam(STATE);
    expect(screen.getByRole("combobox", { name: "Hint for" })).toBeTruthy();
    expect(nameOf(hintButton())).toBe("Hint for Soal 1, minus 5 points, 3 left");
    expect(screen.getByText("Upload file (.xlsm)")).toBeTruthy();
  });

  it("nothing hint-related once received", () => {
    exam(STATE, "received");
    expect(screen.queryByRole("combobox", { name: "Hint for" })).toBeNull();
    expect(screen.queryByText(/Hint \(/)).toBeNull();
  });
});
