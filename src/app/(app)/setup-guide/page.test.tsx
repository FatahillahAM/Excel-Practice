import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadOpenAttempt: vi.fn() }));
vi.mock("../open-attempt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../open-attempt")>();
  return { ...actual, loadOpenAttempt: mocks.loadOpenAttempt };
});
// `open-attempt` imports the session adapters; never reached with `loadOpenAttempt` mocked.
vi.mock("../../../adapters/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("../../../adapters/supabase/auth", () => ({ getSessionUser: vi.fn() }));

import { Kbd } from "../../../components/ui/kbd";
import SetupGuidePage from "./page";
import { SETUP_FOLDER, SETUP_STEPS, STILL_BLOCKED, TRUST_CENTER_PATH } from "./setup-steps";

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
  return renderToStaticMarkup(await SetupGuidePage());
}

/** `>` and `&` as React escapes them in text. */
const escaped = (text: string) => text.replaceAll("&", "&amp;").replaceAll(">", "&gt;");

afterEach(() => {
  mocks.loadOpenAttempt.mockReset();
});

describe("Setup Guide", () => {
  it("without an attempt in progress: title, five numbered steps in order, the last line without Resume", async () => {
    mocks.loadOpenAttempt.mockResolvedValue(null);
    const html = await render();
    expect(html).toMatch(/^<div class="page-enter[^"]*">/);
    expect(html).toMatch(/<h1[^>]*>Setup Guide<\/h1>/);
    const items = html.match(/<li[\s>]/g) ?? [];
    expect(items).toHaveLength(5);
    expect(SETUP_STEPS.map((s) => s.title)).toEqual([
      "Make the working folder",
      "Save downloads there",
      "Trust the folder in Excel",
      "Open the file from the folder",
      "Unblock if Excel still blocks it",
    ]);
    const numbers = SETUP_STEPS.map((_, i) => html.indexOf(`>${i + 1}</span>`));
    const titles = SETUP_STEPS.map((step) => html.indexOf(`>${step.title}</h2>`));
    expect(titles.every((p) => p > 0)).toBe(true);
    expect([...titles].sort((a, b) => a - b)).toEqual(titles);
    expect(numbers.every((p, i) => p > 0 && p < titles[i])).toBe(true);
    expect(html).toContain(STILL_BLOCKED);
    expect(html).not.toContain("Resume");
    expect(html).not.toContain('role="alert"');
  });

  it("puts the folder path and the Trust Center path in <kbd lang=\"en\">, bodies in lang=\"id\"", async () => {
    mocks.loadOpenAttempt.mockResolvedValue(null);
    const html = await render();
    expect(SETUP_FOLDER).toBe("C:\\ExcelPractice");
    expect(html).toMatch(new RegExp(`<kbd [^>]*lang="en"[^>]*>C:\\\\ExcelPractice</kbd>`));
    expect(html).toContain(`lang="en"`);
    const kbdTexts = [...html.matchAll(/<kbd ([^>]*)>([^<]*)<\/kbd>/g)];
    expect(kbdTexts.every(([, attrs]) => attrs.includes('lang="en"'))).toBe(true);
    expect(kbdTexts.map(([, , text]) => text)).toContain(escaped(TRUST_CENTER_PATH));
    expect((html.match(/<p lang="id"/g) ?? []).length).toBe(5);
    // Titles are chrome (no lang="id" on the headings).
    expect(html).not.toMatch(/<h2[^>]*lang=/);
  });

  it.each(["open", "received", "grading_failed"])("%s: the last line with Resume to the exam screen", async (status) => {
    mocks.loadOpenAttempt.mockResolvedValue({ attempt: attempt(status), elapsed: 754 });
    const html = await render();
    expect(html).toMatch(new RegExp(`${STILL_BLOCKED.replace("?", "\\?")} <a [^>]*href="/exam/${ID}"[^>]*>Resume</a>`));
    expect(html).not.toContain("?download=1");
  });

  it("a failed read: the guide without Resume and without an error", async () => {
    mocks.loadOpenAttempt.mockResolvedValue("failed");
    const html = await render();
    expect((html.match(/<li[\s>]/g) ?? []).length).toBe(5);
    expect(html).toContain(STILL_BLOCKED);
    expect(html).not.toContain("Resume");
    expect(html).not.toContain('role="alert"');
  });
});

describe("Kbd", () => {
  it("renders <kbd lang=\"en\"> with the DESIGN.md tokens", () => {
    const html = renderToStaticMarkup(<Kbd>Ctrl</Kbd>);
    expect(html).toMatch(/^<kbd [^>]*lang="en"[^>]*>Ctrl<\/kbd>$/);
    expect(html).toContain("bg-muted");
    expect(html).toContain("border-input-border");
    expect(html).toContain("border-b-2");
    expect(html).toContain("text-[11px]");
  });
});
