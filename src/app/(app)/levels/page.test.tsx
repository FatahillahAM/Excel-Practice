import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadOpenAttempt: vi.fn() }));
vi.mock("./start-actions", () => ({ startAttempt: vi.fn() }));
vi.mock("../open-attempt", () => ({ loadOpenAttempt: mocks.loadOpenAttempt }));

import { levels } from "../../../content/levels";
import { LevelDetailPanel } from "./level-detail-panel";
import Page from "./page";
import { BLOCKED_MESSAGE, StartControl } from "./start-control";

const ID = "0b9e0d6c-3f1a-4c2e-9d55-8a7b6c5d4e3f";
const OPEN = {
  attempt: {
    id: ID,
    itemId: "L01-P1",
    status: "open",
    templateVersion: 1,
    startedAt: "2026-11-02T01:00:00+00:00",
    receivedAt: null,
  },
  title: "Practice 1 · Level 1",
  elapsed: 754,
};

async function renderPage(): Promise<string> {
  return renderToStaticMarkup(await Page());
}

mocks.loadOpenAttempt.mockResolvedValue(null);
const html = await renderPage();

/** The markup of `<tbody>`, where the rows live. */
const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "";

describe("/levels — Level Detail Panel Level 1", () => {
  it("has one Start, 'Start Practice 1', posting item L01-P1", () => {
    expect(html.match(/type="submit"/g)).toHaveLength(1);
    expect(html).toMatch(/<button type="submit"[^>]*>[\s\S]*?Start Practice 1<\/button>/);
    expect(html).toMatch(/<input type="hidden" name="itemId" value="L01-P1"\/>/);
  });

  it("titles the page and the panel", () => {
    expect(html).toContain("Level Map</h1>");
    expect(html).toContain("Level 1 · Active");
    expect(html).toMatch(/<h2 id="([^"]+)" lang="id"[^>]*>Fondasi<\/h2>/);
    const headingId = html.match(/<h2 id="([^"]+)"/)![1];
    expect(html).toContain(`<section aria-labelledby="${headingId}"`);
    expect(html).toContain("$ references · Excel Table (Ctrl+T) · Sort &amp; Filter");
  });

  it("shows five practice rows and the Test row with their statuses", () => {
    expect(body.match(/<tr\b/g)).toHaveLength(6);
    expect(body.match(/Not available yet/g)).toHaveLength(4);
    expect(body).toContain("Next");
    expect(body).toContain("Test opens after 5 practices — 5 to go.");
    for (const header of ["Item", "Best", "Record"]) {
      expect(html).toMatch(new RegExp(`<th scope="col"[^>]*>${header}</th>`));
    }
  });

  it("pairs aria-hidden pips with '0/5 practices done'", () => {
    expect(html).toContain("0/5 practices done");
    expect(html).toMatch(/<div aria-hidden="true"[^>]*>(<span data-pip="[a-z]+"[^>]*><\/span>){5}<\/div>/);
    expect(html.match(/data-pip="next"/g)).toHaveLength(1);
    expect(html.match(/data-pip="pending"/g)).toHaveLength(4);
  });

  it("puts no button in the rows", () => {
    expect(body).not.toContain("<button");
    expect(body).not.toContain("<a ");
  });
});

describe("StartControl", () => {
  it("is enabled and describes itself by the message slot without a lock", () => {
    const markup = renderToStaticMarkup(<StartControl itemId="L01-P1" label="Practice 1" />);
    expect(markup).not.toMatch(/<button[^>]*\sdisabled=""/);
    expect(markup).not.toContain("aria-disabled");
    expect(markup).toContain('aria-describedby="start-L01-P1-message"');
  });

  it("with a lock: disabled, the reason under it, and the reason in aria-describedby", () => {
    const markup = renderToStaticMarkup(
      <StartControl itemId="L01-P1" label="Practice 1" lock={{ reason: BLOCKED_MESSAGE }} fullWidth />,
    );
    expect(markup).toMatch(/<button type="submit" aria-disabled="true"/);
    expect(markup).not.toMatch(/<button[^>]*\sdisabled=""/);
    expect(markup).toContain('aria-describedby="start-L01-P1-lock start-L01-P1-message"');
    expect(markup).toContain(`<p id="start-L01-P1-lock"`);
    expect(markup).toContain(BLOCKED_MESSAGE);
    expect(markup).toContain("bg-muted");
    expect(markup).not.toContain("--primary-edge");
  });
});

describe("LevelDetailPanel with startLock", () => {
  it("passes the lock to the foot Start: aria-disabled, focusable, reason read", () => {
    const markup = renderToStaticMarkup(<LevelDetailPanel level={levels[0]} startLock={{ reason: BLOCKED_MESSAGE }} />);
    const button = markup.match(/<button[^>]*>/)?.[0] ?? "";
    expect(button).toContain('aria-disabled="true"');
    expect(button).not.toMatch(/\sdisabled=""/);
    expect(button).toContain('aria-describedby="start-L01-P1-lock start-L01-P1-message"');
    expect(markup).toMatch(new RegExp(`<p id="start-L01-P1-lock"[^>]*>${BLOCKED_MESSAGE}</p>`));
    expect(markup.match(new RegExp(BLOCKED_MESSAGE, "g"))).toHaveLength(1);
  });
});

describe("/levels — Start lock from the attempt in progress", () => {
  beforeEach(() => mocks.loadOpenAttempt.mockReset());
  afterEach(() => mocks.loadOpenAttempt.mockResolvedValue(null));

  it("an attempt in progress: Start aria-disabled, focusable, the reason in aria-describedby, and a link to it", async () => {
    mocks.loadOpenAttempt.mockResolvedValue(OPEN);
    const markup = await renderPage();
    const button = markup.match(/<button[^>]*>/)?.[0] ?? "";
    expect(button).toContain('aria-disabled="true"');
    expect(button).not.toMatch(/\sdisabled=""/);
    expect(button).toContain('aria-describedby="start-L01-P1-lock start-L01-P1-message"');
    expect(markup).toMatch(
      new RegExp(`<p id="start-L01-P1-lock"[^>]*>${BLOCKED_MESSAGE} <a href="/exam/${ID}"[^>]*>Go to the attempt</a></p>`),
    );
    expect(markup.match(new RegExp(BLOCKED_MESSAGE, "g"))).toHaveLength(1);
  });

  it.each([
    ["no attempt", null],
    ["a failed read", "failed"],
  ])("%s: Start is not locked", async (_name, loaded) => {
    mocks.loadOpenAttempt.mockResolvedValue(loaded);
    const markup = await renderPage();
    expect(markup).not.toContain("aria-disabled");
    expect(markup).not.toContain(BLOCKED_MESSAGE);
    expect(markup).not.toContain("Go to the attempt");
    expect(markup).toContain('aria-describedby="start-L01-P1-message"');
  });
});

describe("StartControl lock without attemptId (the { reason } shape)", () => {
  it("shows the reason only", () => {
    const markup = renderToStaticMarkup(<StartControl itemId="L01-P1" label="Practice 1" lock={{ reason: BLOCKED_MESSAGE }} />);
    expect(markup).toMatch(new RegExp(`<p id="start-L01-P1-lock"[^>]*>${BLOCKED_MESSAGE}</p>`));
    expect(markup).not.toContain("Go to the attempt");
  });
});
