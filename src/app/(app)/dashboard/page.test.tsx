import { renderToStaticMarkup } from "react-dom/server";
import { prerender } from "react-dom/static";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadOpenAttempt: vi.fn(), loadProgress: vi.fn(), loadStreak: vi.fn() }));
vi.mock("./abandon-actions", () => ({ abandonAttempt: vi.fn() }));
vi.mock("../open-attempt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../open-attempt")>();
  return { ...actual, loadOpenAttempt: mocks.loadOpenAttempt };
});
vi.mock("../progress", () => ({ loadProgress: mocks.loadProgress, loadStreak: mocks.loadStreak }));
vi.mock("./freeze-actions", () => ({ freezeToday: vi.fn() }));
// `open-attempt` imports the session adapters; never reached with `loadOpenAttempt` mocked.
vi.mock("@/adapters/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/adapters/supabase/auth", () => ({ getSessionUser: vi.fn() }));

import { shellMessages } from "@/messages/id";
import DashboardPage from "./page";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const attempt = (status: string) => ({
  id: ID,
  itemId: "L01-P1",
  status,
  templateVersion: 1,
  startedAt: "2026-11-02T01:00:00+00:00",
  receivedAt: status === "open" ? null : "2026-11-02T01:10:00+00:00",
});

async function render(): Promise<string> {
  return renderToStaticMarkup(await DashboardPage());
}

afterEach(() => {
  mocks.loadOpenAttempt.mockReset();
});

describe("Dashboard", () => {
  it("without an attempt in progress: the title, no Attempt Card, no alert", async () => {
    mocks.loadOpenAttempt.mockResolvedValue(null);
    const html = await render();
    expect(html).toMatch(/<h1 id="dashboard-title" tabindex="-1"[^>]*>Dashboard<\/h1>/);
    expect(html).not.toContain("Attempt in progress");
    expect(html).not.toContain("Resume");
    expect(html).not.toContain('role="alert"');
    // The Level Path streams in its own Suspense boundary: its skeleton first.
    expect(html).toContain('data-slot="level-path-skeleton"');
  });

  it("open: the Attempt Card with name, time since Start, Resume to the exam screen and an Abandon trigger", async () => {
    mocks.loadOpenAttempt.mockResolvedValue({ attempt: attempt("open"), elapsed: 754 });
    const html = await render();
    expect(html).toContain("Attempt in progress");
    expect(html).toContain("Practice 1 · Level 1");
    expect(html).toMatch(/>12:34<\/span><span[^>]*>since Start<\/span>/);
    expect(html).toMatch(new RegExp(`<a [^>]*href="/exam/${ID}"[^>]*>[\\s\\S]*?Resume</a>`));
    expect(html).not.toContain("?download=1");
    expect(html).toMatch(/<button type="button"[^>]*aria-haspopup="dialog"[^>]*>Abandon<\/button>/);
    // The dialog renders only when opened.
    expect(html).not.toContain("Abandon this attempt?");
    const headingId = html.match(/<h2 id="([^"]+)"/)![1];
    expect(html).toContain(`<section aria-labelledby="${headingId}"`);
  });

  it.each([
    ["received", "File received — grading…"],
    ["grading_failed", "File received — grading failed."],
  ])("%s: '%s' instead of the time", async (status, caption) => {
    mocks.loadOpenAttempt.mockResolvedValue({ attempt: attempt(status), elapsed: 754 });
    const html = await render();
    expect(html).toContain(caption);
    expect(html).not.toContain("since Start");
    expect(html).toContain(`href="/exam/${ID}"`);
    expect(html).toContain(">Abandon</button>");
  });

  it("a failed read: the first-load message in the card's slot, with Try again", async () => {
    mocks.loadOpenAttempt.mockResolvedValue("failed");
    const html = await render();
    expect(html).toMatch(new RegExp(`<p role="alert" lang="id">${shellMessages.firstLoadFailed}</p>`));
    expect(html).toContain('href="/dashboard"');
    expect(html).not.toContain("Attempt in progress");
  });
});

describe("Dashboard with the Level Path resolved", () => {
  /** Every Suspense boundary resolved (the Level Path's progress read included). */
  async function renderAll(): Promise<string> {
    const { prelude } = await prerender(await DashboardPage());
    return new Response(prelude).text();
  }

  it("a failed progress read with an attempt in progress: both the Resume card and the alert", async () => {
    mocks.loadOpenAttempt.mockResolvedValue({ attempt: attempt("open"), elapsed: 754 });
    mocks.loadProgress.mockResolvedValue("failed");
    const html = await renderAll();
    expect(html).toContain("Attempt in progress");
    expect(html).toMatch(new RegExp(`<a [^>]*href="/exam/${ID}"[^>]*>[\\s\\S]*?Resume</a>`));
    expect(html).toMatch(new RegExp(`<p role="alert" lang="id">${shellMessages.firstLoadFailed}</p>`));
    expect(html).not.toContain('aria-label="Level path"');
    mocks.loadProgress.mockReset();
  });

  it("the Streak Hero's final numeral is in the server HTML; on the phone the rail (hero first) leads", async () => {
    mocks.loadOpenAttempt.mockResolvedValue({ attempt: attempt("open"), elapsed: 754 });
    mocks.loadProgress.mockResolvedValue("failed");
    mocks.loadStreak.mockResolvedValue({
      today: "2026-11-19",
      count: 12,
      todaySafe: true,
      frozenToday: false,
      msLeft: 0,
      week: [],
      freezesLeft: 2,
    });
    const html = await renderAll();
    expect(html).toMatch(/data-slot="streak-numeral"[^>]*>12<\/span>/);
    expect(html).toMatch(/<div class="order-first flex w-full flex-col[^"]*lg:order-none/);
    expect(html).toMatch(/<div class="order-first flex flex-col lg:order-none">[\s\S]*streak-numeral/);
    mocks.loadProgress.mockReset();
    mocks.loadStreak.mockReset();
  });
});
