// @vitest-environment jsdom
import "@/test/dom";
import { act, render, screen } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  // One stable router object: the poll effect depends on it.
  router: { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() },
  retryGrading: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  // As Next's: rethrows its own control-flow errors (redirect), lets anything else through.
  unstable_rethrow: (error: unknown) => {
    if (String((error as { digest?: unknown } | null)?.digest ?? "").startsWith("NEXT_REDIRECT")) throw error;
  },
}));
vi.mock("./retry-actions", () => ({ retryGrading: mocks.retryGrading }));

import { examMessages, shellMessages } from "@/messages/id";
import { ExamStatus, POLL_MS } from "./exam-status";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const STATUS_URL = `/api/attempts/${ID}/status`;

type Answer = { http: number; body?: unknown };
const answer = (status: string, resultId: string | null = null): Answer => ({
  http: 200,
  body: { ok: true, data: { status, elapsedSeconds: 60, resultId } },
});

/** What the status endpoint answers next: the queue first, then `fallback` for every later poll. */
let queue: Answer[];
let fallback: Answer;
type FetchAnswer = { status: number; ok: boolean; json: () => Promise<unknown> };
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<FetchAnswer>>(async () => {
  const next = queue.shift() ?? fallback;
  return { status: next.http, ok: next.http >= 200 && next.http < 300, json: async () => next.body };
});

beforeEach(() => {
  vi.useFakeTimers();
  queue = [];
  fallback = answer("received");
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockClear();
  mocks.router.replace.mockReset();
  mocks.retryGrading.mockReset();
});

function show(initialStatus: "open" | "received" | "grading_failed", initialReceivedSeconds: number | null = null) {
  return render(
    <ExamStatus
      attemptId={ID}
      itemLabel="Practice 1"
      initialStatus={initialStatus}
      initialElapsed={60}
      initialReceivedSeconds={initialReceivedSeconds}
    />,
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

/**
 * Lets `ms` pass, with every timer, poll answer and state update it brings.
 * In steps of 100 ms: a poll re-arms its timer from state set when `act()` ends.
 */
async function pass(ms: number): Promise<void> {
  let left = ms;
  do {
    const step = Math.min(left, 100);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
    left -= step;
  } while (left > 0);
}

const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTimeAsync });
const statusLineText = () => screen.getAllByRole("status")[0].textContent;

describe("ExamStatus in the DOM", () => {
  it("(a) polls received, then graded with a resultId: replaces with Results once and polls no more", async () => {
    queue = [answer("received"), answer("graded", ID)];
    show("open");
    expect(statusLineText()).toBe("Excel is open — Practice 1");

    await pass(POLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(STATUS_URL, { cache: "no-store" });
    expect(statusLineText()).toBe("File received — grading…");
    expect(mocks.router.replace).not.toHaveBeenCalled();

    await pass(POLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.router.replace).toHaveBeenCalledTimes(1);
    expect(mocks.router.replace).toHaveBeenCalledWith(`/results/${ID}`);

    // Leaving: the screen keeps its last state and nothing polls while Results loads.
    await pass(POLL_MS * 5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.router.replace).toHaveBeenCalledTimes(1);
    expect(statusLineText()).toBe("File received — grading…");
  });

  it("(b) shows the slow-grading message after 15 s in received, not before", async () => {
    show("received", 0);
    expect(screen.queryByText(examMessages.gradingSlow)).toBeNull();

    await pass(14_900);
    expect(screen.queryByText(examMessages.gradingSlow)).toBeNull();
    expect(statusLineText()).toBe("File received — grading…");

    await pass(200);
    const slow = screen.getByText(examMessages.gradingSlow);
    expect(slow.closest('[role="status"]')?.getAttribute("lang")).toBe("id");
    // Still polling, still received.
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(7);
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("(c) grading failed: alert and Try again; the click retries, the line says grading, then graded moves to Results", async () => {
    fallback = answer("grading_failed");
    mocks.retryGrading.mockResolvedValue({ status: "retried" });
    const { container } = show("grading_failed", 600);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(examMessages.gradingFailed);
    expect(alert.getAttribute("lang")).toBe("id");
    expect(alert.className).toContain("text-destructive");
    expect(statusLineText()).toBe("File received — grading failed.");
    // The Orbit has stopped: no loader on screen.
    expect(container.querySelector("svg")).toBeNull();

    // The poll goes on while failed.
    await pass(POLL_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert").textContent).toBe(examMessages.gradingFailed);

    fallback = answer("received");
    await user().click(screen.getByRole("button", { name: "Try again" }));
    await pass(0);

    expect(mocks.retryGrading).toHaveBeenCalledTimes(1);
    const [previous, formData] = mocks.retryGrading.mock.calls[0] as [unknown, FormData];
    expect(previous).toEqual({ status: "idle" });
    expect(formData.get("attemptId")).toBe(ID);

    expect(statusLineText()).toBe("File received — grading…");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    // The slow message counts from 0 again, whatever the first grading took.
    expect(screen.queryByText(examMessages.gradingSlow)).toBeNull();

    queue = [answer("graded", ID)];
    await pass(POLL_MS);
    expect(mocks.router.replace).toHaveBeenCalledTimes(1);
    expect(mocks.router.replace).toHaveBeenCalledWith(`/results/${ID}`);
  });

  it("(c) Try again shows it is pending, with the button disabled, until the action answers", async () => {
    fallback = answer("grading_failed");
    let settle: (state: { status: "retried" }) => void = () => {};
    mocks.retryGrading.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    show("grading_failed", 600);

    await user().click(screen.getByRole("button", { name: "Try again" }));
    const pending = screen.getByRole("button", { name: "Trying again…" }) as HTMLButtonElement;
    expect(pending.disabled).toBe(true);

    await act(async () => {
      settle({ status: "retried" });
    });
    expect(statusLineText()).toBe("File received — grading…");
  });

  it("(d) Try again that fails: the network message in the alert, and the button back", async () => {
    fallback = answer("grading_failed");
    mocks.retryGrading.mockResolvedValue({ status: "error" });
    show("grading_failed", 600);

    await user().click(screen.getByRole("button", { name: "Try again" }));
    await pass(0);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(examMessages.retryFailed);
    expect(alert.className).toContain("text-destructive");
    const button = screen.getByRole("button", { name: "Try again" }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    expect(statusLineText()).toBe("File received — grading failed.");

    // A second click tries again; while it is pending the alert is back to the failure message.
    let settle: (state: { status: "retried" }) => void = () => {};
    mocks.retryGrading.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    await user().click(button);
    expect(screen.getByRole("button", { name: "Trying again…" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe(examMessages.gradingFailed);
    await act(async () => {
      settle({ status: "retried" });
    });
    expect(mocks.retryGrading).toHaveBeenCalledTimes(2);
    expect(statusLineText()).toBe("File received — grading…");
  });

  it("(d) a Try again error is dropped once the polled status leaves grading_failed", async () => {
    fallback = answer("grading_failed");
    mocks.retryGrading.mockResolvedValue({ status: "error" });
    show("grading_failed", 600);
    await user().click(screen.getByRole("button", { name: "Try again" }));
    await pass(0);
    expect(screen.getByRole("alert").textContent).toBe(examMessages.retryFailed);

    // Another device retried and that grading failed again: a fresh failure, not the old error.
    queue = [answer("received"), answer("grading_failed")];
    await pass(POLL_MS);
    expect(statusLineText()).toBe("File received — grading…");
    await pass(POLL_MS);
    expect(statusLineText()).toBe("File received — grading failed.");
    expect(screen.getByRole("alert").textContent).toBe(examMessages.gradingFailed);
  });

  it("(d) a Try again that throws a plain error: the network message, the button back", async () => {
    fallback = answer("grading_failed");
    mocks.retryGrading.mockRejectedValue(new TypeError("Failed to fetch"));
    show("grading_failed", 600);
    await user().click(screen.getByRole("button", { name: "Try again" }));
    await pass(0);
    expect(screen.getByRole("alert").textContent).toBe(examMessages.retryFailed);
    expect((screen.getByRole("button", { name: "Try again" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("(d) a redirect thrown by Try again (no session → Login) is rethrown, not turned into a message", async () => {
    fallback = answer("grading_failed");
    mocks.retryGrading.mockRejectedValue(
      Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" }),
    );
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Boundary>
        <ExamStatus
          attemptId={ID}
          itemLabel="Practice 1"
          initialStatus="grading_failed"
          initialElapsed={60}
          initialReceivedSeconds={600}
        />
      </Boundary>,
    );
    await user().click(screen.getByRole("button", { name: "Try again" }));
    await pass(0);
    expect(screen.getByTestId("caught").textContent).toBe("NEXT_REDIRECT");
    expect(screen.queryByText(examMessages.retryFailed)).toBeNull();
    quiet.mockRestore();
  });

  it("(c) Try again unchanged (moved elsewhere): line, alert and button stay until the next poll says otherwise", async () => {
    fallback = answer("grading_failed");
    mocks.retryGrading.mockResolvedValue({ status: "unchanged" });
    show("grading_failed", 600);
    await user().click(screen.getByRole("button", { name: "Try again" }));
    await pass(0);
    expect(statusLineText()).toBe("File received — grading failed.");
    expect(screen.getByRole("alert").textContent).toBe(examMessages.gradingFailed);
    expect((screen.getByRole("button", { name: "Try again" }) as HTMLButtonElement).disabled).toBe(false);

    queue = [answer("received")];
    await pass(POLL_MS);
    expect(statusLineText()).toBe("File received — grading…");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("(e) a poll answered 401: the first-load message, and no more polls", async () => {
    queue = [{ http: 401, body: { ok: false, code: "UNAUTHENTICATED" } }];
    show("received", 0);

    await pass(POLL_MS);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(shellMessages.firstLoadFailed);
    expect(alert.getAttribute("lang")).toBe("id");
    expect(screen.queryByRole("status")).toBeNull();
    expect((screen.getByRole("link", { name: "Try again" }) as HTMLAnchorElement).getAttribute("href")).toBe(`/exam/${ID}`);

    await pass(POLL_MS * 5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
