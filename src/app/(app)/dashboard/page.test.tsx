import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadOpenAttempt: vi.fn() }));
vi.mock("./abandon-actions", () => ({ abandonAttempt: vi.fn() }));
vi.mock("../open-attempt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../open-attempt")>();
  return { ...actual, loadOpenAttempt: mocks.loadOpenAttempt };
});
// `open-attempt` imports the session adapters; never reached with `loadOpenAttempt` mocked.
vi.mock("../../../adapters/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("../../../adapters/supabase/auth", () => ({ getSessionUser: vi.fn() }));

import { shellMessages } from "../../../messages/id";
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
  });

  it("open: the Attempt Card with name, time since Start, Resume to the exam screen and an Abandon trigger", async () => {
    mocks.loadOpenAttempt.mockResolvedValue({ attempt: attempt("open"), title: "Practice 1 · Level 1", elapsed: 754 });
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

  it.each(["received", "grading_failed"])("%s: 'File received — grading…' instead of the time", async (status) => {
    mocks.loadOpenAttempt.mockResolvedValue({ attempt: attempt(status), title: "Practice 1 · Level 1", elapsed: 754 });
    const html = await render();
    expect(html).toContain("File received — grading…");
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
