// @vitest-environment jsdom
import "@/test/dom";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() },
  revealHint: vi.fn(),
  retryGrading: vi.fn(),
  onResync: vi.fn(),
  onNotOpen: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  // As Next's: rethrows its own control-flow errors (redirect), lets anything else through.
  unstable_rethrow: (error: unknown) => {
    if (String((error as { digest?: unknown } | null)?.digest ?? "").startsWith("NEXT_REDIRECT")) throw error;
  },
}));
vi.mock("./hint-actions", () => ({ revealHint: mocks.revealHint }));
vi.mock("./retry-actions", () => ({ retryGrading: mocks.retryGrading }));

import type { HintState } from "@/core/services/attempts";
import { hintMessages } from "@/messages/id";
import { ExamStatus, POLL_MS } from "./exam-status";
import { HintPanel, hintNotices } from "./hint-panel";

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

const revealed = (question: number, index: number, used: number) => ({
  status: "revealed",
  reveal: { question, index, text: text(question, index) },
  used,
  quota: 3,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** HintPanel with its state held as ExamStatus holds it. */
function Harness({ initial }: { initial: HintState }) {
  const [state, setState] = useState(initial);
  return (
    <HintPanel
      attemptId={ID}
      state={state}
      onChange={(update) => setState((current) => update(current))}
      onResync={mocks.onResync}
      onNotOpen={mocks.onNotOpen}
      beside={<div>Dropzone here</div>}
    />
  );
}

/** Catches what a render or a form action throws, to show it propagated past the component. */
class Boundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    return this.state.error === null ? this.props.children : <p data-testid="caught">{String((this.state.error as Error).message)}</p>;
  }
}

function show(initial: HintState = STATE) {
  return render(<Harness initial={initial} />);
}

/** The accessible name as the markup sets it: `aria-label`, else the text. */
const nameOf = (element: Element | null) => element?.getAttribute("aria-label") ?? element?.textContent ?? "";
/** The name `aria-labelledby` gives: the referenced elements' text, in order. */
const labelledName = (element: Element) =>
  (element.getAttribute("aria-labelledby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");

const hintButton = () => screen.getByRole("button", { name: /^(Hint for Soal|No hints left|All hints for)/ });
const trigger = () => screen.getByRole("combobox");
const notice = () => screen.getByRole("status").textContent;
const focused = () => document.activeElement;

async function pickSoal(user: ReturnType<typeof userEvent.setup>, n: number) {
  await user.click(trigger());
  await user.click(await screen.findByRole("option", { name: `Soal ${n}` }));
}

beforeEach(() => {
  mocks.revealHint.mockImplementation(serverLike());
});

afterEach(() => {
  mocks.revealHint.mockReset();
  mocks.router.refresh.mockReset();
  mocks.onResync.mockReset();
  mocks.onNotOpen.mockReset();
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
    expect(container.getAttribute("tabindex")).toBe("-1");
    expect(focused()).toBe(container);
    expect(within(container).getByText(/Hint 1 ·/).textContent).toBe("Hint 1 · Soal 2");
    expect(within(container).getByText("−5")).toBeTruthy();
    expect(block.getAttribute("lang")).toBe("id");
    expect(nameOf(hintButton())).toBe("Hint for Soal 2, minus 5 points, 2 left");
    expect(hintButton().textContent).toContain("2 left");
    // One combined, polite announcement.
    expect(notice()).toBe("Hint revealed, 2 hints left.");

    // The next press for the same soal asks for its next hint.
    await user.click(hintButton());
    expect(formOf(1)).toMatchObject({ question: "2", hintIndex: "1" });
    expect(await screen.findByText(text(2, 1))).toBeTruthy();
    expect(notice()).toBe("Hint revealed, 1 hint left.");
  });

  it("the Select is named by its visible label and its value ('Hint for Soal 2')", async () => {
    const user = userEvent.setup();
    show();
    expect(trigger().getAttribute("aria-label")).toBeNull();
    expect(screen.getByText("Hint for", { selector: "span" })).toBeTruthy();
    expect(labelledName(trigger())).toBe("Hint for Soal 1");
    await pickSoal(user, 2);
    expect(labelledName(trigger())).toBe("Hint for Soal 2");
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
    expect(notice()).toBe("Hint revealed, 0 hints left.");

    const button = hintButton();
    expect(nameOf(button)).toBe("No hints left");
    expect(button.textContent).toContain("No hints left");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    // Focus is on the last hint; the keyboard brings it to the button, and pressing keeps it there.
    expect(focused()).not.toBe(button);
    button.focus();
    await user.keyboard("{Enter}");
    expect(focused()).toBe(button);
    await user.click(button);
    expect(focused()).toBe(button);
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
    expect(hintButton().getAttribute("aria-disabled")).toBe("true");
    expect(hintButton().getAttribute("aria-busy")).toBe("true");
    await act(async () => {
      answer.resolve(revealed(1, 0, 1));
    });
    expect(await screen.findByText(text(1, 0))).toBeTruthy();
    expect(hintButton().getAttribute("aria-disabled")).toBeNull();
    expect(mocks.revealHint).toHaveBeenCalledTimes(1);
  });

  it("the submit lock alone: two submits before any re-render post once", async () => {
    const answer = deferred<unknown>();
    mocks.revealHint.mockImplementation(() => answer.promise);
    show();
    const form = hintButton().closest("form") as HTMLFormElement;
    // Both inside one act(): React has not re-rendered (no `pending` yet), so only the ref can refuse the second.
    act(() => {
      form.requestSubmit();
      form.requestSubmit();
    });
    await act(async () => {
      answer.resolve(revealed(1, 0, 1));
    });
    expect(mocks.revealHint).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(text(1, 0))).toHaveLength(1);
  });

  it("(d) already: the hint is not listed twice and costs nothing more", async () => {
    const user = userEvent.setup();
    const initial = { ...STATE, used: 1, revealed: [{ question: 1, index: 0, text: text(1, 0) }] };
    mocks.revealHint.mockResolvedValue({ status: "already", reveal: { question: 1, index: 0, text: text(1, 0) }, used: 1, quota: 3 });
    show(initial);
    hintButton().focus();
    await user.keyboard("{Enter}");
    expect(mocks.revealHint).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(text(1, 0))).toHaveLength(1);
    expect(hintButton().textContent).toContain("2 left");
    expect(focused()).toBe(screen.getByText(text(1, 0)).closest("[data-hint]"));
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
    expect(items.map((item) => item.textContent)).toEqual([`Hint 1 · Soal 3−5${text(3, 0)}`, `Hint 1 · Soal 1−5${text(1, 0)}`]);
    expect(nameOf(hintButton())).toBe("Hint for Soal 1, minus 5 points, 1 left");
    // Soal 1 already showed hint 1: the next press asks for index 1.
    expect((document.querySelector('input[name="hintIndex"]') as HTMLInputElement).value).toBe("1");
  });

  it("(f) error: the network alert (lang id), the button usable again, focus back on it from elsewhere", async () => {
    const user = userEvent.setup();
    const answer = deferred<unknown>();
    mocks.revealHint.mockImplementation(() => answer.promise);
    show();
    hintButton().focus();
    await user.keyboard("{Enter}");
    // Focus wanders off while the request is pending.
    trigger().focus();
    expect(focused()).toBe(trigger());
    await act(async () => {
      answer.resolve({ status: "error" });
    });
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(hintMessages.failed);
    expect(alert.getAttribute("lang")).toBe("id");
    expect(hintButton().getAttribute("aria-disabled")).toBeNull();
    expect(focused()).toBe(hintButton());
  });

  it("a plain error thrown by the action: the network alert", async () => {
    const user = userEvent.setup();
    mocks.revealHint.mockRejectedValue(new TypeError("Failed to fetch"));
    show();
    await user.click(hintButton());
    expect((await screen.findByRole("alert")).textContent).toBe(hintMessages.failed);
  });

  it("a redirect thrown by the action (no session → Login) is rethrown, not turned into a message", async () => {
    const user = userEvent.setup();
    mocks.revealHint.mockRejectedValue(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" }));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Boundary>
        <Harness initial={STATE} />
      </Boundary>,
    );
    await user.click(hintButton());
    expect((await screen.findByTestId("caught")).textContent).toBe("NEXT_REDIRECT");
    expect(screen.queryByText(hintMessages.failed)).toBeNull();
    quiet.mockRestore();
  });

  it("(g) not_open: the 'no longer running' alert, focus on the button, and ExamStatus is asked to poll now", async () => {
    const user = userEvent.setup();
    const answer = deferred<unknown>();
    mocks.revealHint.mockImplementation(() => answer.promise);
    show();
    hintButton().focus();
    await user.keyboard("{Enter}");
    trigger().focus();
    await act(async () => {
      answer.resolve({ status: "not_open" });
    });
    expect((await screen.findByRole("alert")).textContent).toBe(hintMessages.notOpen);
    expect(focused()).toBe(hintButton());
    expect(mocks.onNotOpen).toHaveBeenCalledTimes(1);
  });

  it("quota_used from the server (another tab): 'No hints left', said in the status line, focus on the button", async () => {
    const user = userEvent.setup();
    const answer = deferred<unknown>();
    mocks.revealHint.mockImplementation(() => answer.promise);
    show();
    hintButton().focus();
    await user.keyboard("{Enter}");
    trigger().focus();
    await act(async () => {
      answer.resolve({ status: "quota_used", used: 3, quota: 3 });
    });
    const button = screen.getByRole("button", { name: "No hints left" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(notice()).toBe(hintNotices.quotaUsed);
    expect(focused()).toBe(button);
  });

  it("no_more_hints from the server: that soal's button turns aria-disabled, said in the status line", async () => {
    const user = userEvent.setup();
    mocks.revealHint.mockResolvedValue({ status: "no_more_hints", used: 0, quota: 3 });
    show();
    await user.click(hintButton());
    const button = await screen.findByRole("button", { name: "All hints for Soal 1 shown" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(notice()).toBe("All hints for Soal 1 shown.");
    expect(focused()).toBe(button);
  });

  it("out_of_order: says the hints were refreshed and asks for the server state", async () => {
    const user = userEvent.setup();
    mocks.revealHint.mockResolvedValue({ status: "out_of_order", used: 2, quota: 3 });
    show();
    await user.click(hintButton());
    await vi.waitFor(() => expect(mocks.onResync).toHaveBeenCalledTimes(1));
    expect(notice()).toBe(hintNotices.refreshed);
    expect(focused()).toBe(hintButton());
  });

  it("a soal whose hints are all shown: aria-disabled 'All hints for Soal N shown', nothing posted", async () => {
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
    expect(hintButton().getAttribute("aria-disabled")).toBe("true");
    await user.click(hintButton());
    expect(mocks.revealHint).not.toHaveBeenCalled();
    await pickSoal(user, 2);
    expect(nameOf(hintButton())).toBe("Hint for Soal 2, minus 5 points, 2 left");
  });

  it("the Select + button row wraps on narrow screens", () => {
    show();
    const row = trigger().parentElement as HTMLElement;
    expect(row.className).toContain("flex-wrap");
    expect(row.contains(hintButton())).toBe(true);
    expect(screen.getByText("Dropzone here")).toBeTruthy();
  });
});

describe("ExamStatus hint state", () => {
  type FetchAnswer = { status: number; ok: boolean; json: () => Promise<unknown> };
  let polled: string[];
  const fetchMock = vi.fn<(url: string) => Promise<FetchAnswer>>();

  beforeEach(() => {
    polled = [];
    // The poll never answers unless a test queues an answer.
    fetchMock.mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  const exam = (hints: HintState | null, status: "open" | "received" = "open") => (
    <ExamStatus
      attemptId={ID}
      itemLabel="Practice 1"
      initialStatus={status}
      initialElapsed={60}
      initialReceivedSeconds={status === "open" ? null : 1}
      hints={hints}
    />
  );
  const answerStatus = (status: string) => {
    fetchMock.mockImplementation(async (url: string) => {
      polled.push(url);
      return { status: 200, ok: true, json: async () => ({ ok: true, data: { status, elapsedSeconds: 61, resultId: null } }) };
    });
  };
  const withReveals = (n: number): HintState => ({
    ...STATE,
    used: n,
    revealed: Array.from({ length: n }, (_, i) => ({ question: i + 1, index: 0, text: text(i + 1, 0) })),
  });

  it("(h) quota 0: no hint group, the Dropzone alone", () => {
    render(exam({ ...STATE, quota: 0 }));
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Hint/ })).toBeNull();
    expect(screen.getByText("Upload file (.xlsm)")).toBeTruthy();
  });

  it("no hint state (the read failed): no hint group, the Dropzone alone", () => {
    render(exam(null));
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("Upload file (.xlsm)")).toBeTruthy();
  });

  it("open with quota: the hint group beside the Dropzone", () => {
    render(exam(STATE));
    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(nameOf(hintButton())).toBe("Hint for Soal 1, minus 5 points, 3 left");
    expect(screen.getByText("Upload file (.xlsm)")).toBeTruthy();
  });

  it("received with reveals: the revealed hints read-only — no Select, no button", () => {
    render(exam(withReveals(2), "received"));
    expect(screen.getByText(text(1, 0))).toBeTruthy();
    expect(screen.getByText(text(2, 0))).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText(/Hint \(/)).toBeNull();
  });

  it("keeps the revealed hints, read-only, when a poll sees the attempt leave open", async () => {
    vi.useFakeTimers();
    render(exam(withReveals(1)));
    answerStatus("received");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });
    expect(polled).toHaveLength(1);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText(text(1, 0))).toBeTruthy();
  });

  it("a reveal that resolves after the attempt left open still joins the read-only list", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
    const answer = deferred<unknown>();
    mocks.revealHint.mockImplementation(() => answer.promise);
    render(exam(STATE));
    await user.click(hintButton());
    expect(mocks.revealHint).toHaveBeenCalledTimes(1);
    answerStatus("received");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });
    expect(screen.queryByRole("combobox")).toBeNull();
    await act(async () => {
      answer.resolve(revealed(2, 0, 1));
    });
    expect(screen.getByText(text(2, 0))).toBeTruthy();
    expect(screen.queryByText(/Hint \(/)).toBeNull();
  });

  it("not_open from a hint press polls the status now, not after POLL_MS", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
    mocks.revealHint.mockResolvedValue({ status: "not_open" });
    render(exam(STATE));
    answerStatus("received");
    await user.click(hintButton());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(polled).toHaveLength(1);
    // The poll's answer moves the screen on at once: the hint group (and its alert) leave with `open`.
    expect(screen.getByText("File received — grading…")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("a refresh replaces the hint state only when the server has at least as many reveals", () => {
    const { rerender } = render(exam(withReveals(2)));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    // An older server state (1 reveal) never wipes the newer local one.
    rerender(exam(withReveals(1)));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(hintButton().textContent).toContain("1 left");
    // A newer one replaces it.
    rerender(exam(withReveals(3)));
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(nameOf(hintButton())).toBe("No hints left");
  });

  it("out_of_order: refreshes, and the next server state replaces the local one even with fewer reveals", async () => {
    const user = userEvent.setup();
    mocks.revealHint.mockResolvedValue({ status: "out_of_order", used: 1, quota: 3 });
    const { rerender } = render(exam(withReveals(2)));
    await user.click(hintButton());
    await vi.waitFor(() => expect(mocks.router.refresh).toHaveBeenCalledTimes(1));
    rerender(exam(withReveals(1)));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
