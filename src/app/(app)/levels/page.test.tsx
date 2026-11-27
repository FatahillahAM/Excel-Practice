import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ loadOpenAttempt: vi.fn(), loadProgress: vi.fn() }));
vi.mock("./start-actions", () => ({ startAttempt: vi.fn() }));
vi.mock("../open-attempt", () => ({ loadOpenAttempt: mocks.loadOpenAttempt }));
// The page reads `loadLevelMap`; these tests drive its progress (no records).
vi.mock("../progress", () => ({
  loadLevelMap: async () => {
    const progress = await mocks.loadProgress();
    return progress === "failed" ? "failed" : { records: new Map(), bestScores: new Map(), progress };
  },
}));

import { levels } from "@/content/levels";
import { levelProgress } from "@/core/progress";
import { shellMessages } from "@/messages/id";
import { LevelDetailPanel } from "./level-detail-panel";
import Page from "./page";
import { StartControl } from "./start-control";
import { BLOCKED_MESSAGE } from "./start-lock";

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
  elapsed: 754,
};

async function renderPage(): Promise<string> {
  return renderToStaticMarkup(await Page());
}

mocks.loadOpenAttempt.mockResolvedValue(null);
const NO_PROGRESS = levelProgress([], levels);
mocks.loadProgress.mockResolvedValue(NO_PROGRESS);
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

  it("shows five practice rows and the Test row with their statuses (real P1..P5 and L01-T: locked, 5 to go)", () => {
    expect(body.match(/<tr\b/g)).toHaveLength(6);
    expect(body).not.toContain("Not available yet");
    expect(body).toContain("Next");
    expect(body).toContain("Test opens after 5 practices — 5 to go.");
    expect(body).not.toContain("The Test for this level isn&#x27;t ready yet.");
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

  it("puts no Start in the rows: their only buttons open a Practice's Materi (5.7)", () => {
    const buttons = body.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(4); // P2–P5; P1 (next) has its Materi above Start
    for (const button of buttons) expect(button).toContain('data-slot="materi-trigger"');
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
    const button = (markup.match(/<button[^>]*>/g) ?? []).find((tag) => !tag.includes("materi-trigger")) ?? "";
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
    const button = markup.match(/<button type="submit"[^>]*>/)?.[0] ?? "";
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

describe("/levels — progress (the Dashboard's read)", () => {
  afterEach(() => mocks.loadProgress.mockResolvedValue(NO_PROGRESS));
  const at = (itemId: string) => ({ id: itemId, itemId, score: 40, startedAt: "2026-11-02T01:00:00Z", receivedAt: "2026-11-02T01:10:00Z" });

  it("marks a practice done in the progress as done (1/5, no Start for it)", async () => {
    mocks.loadProgress.mockResolvedValue(levelProgress([at("L01-P1")], levels));
    const markup = await renderPage();
    expect(markup).toContain("1/5 practices done");
    expect(markup).toContain("✓ Done");
    expect(markup.match(/data-pip="done"/g)).toHaveLength(1);
    expect(markup).not.toContain("Start Practice 1");
  });

  it("no active or passed level (nothing open): an empty state, no panel or Start", async () => {
    mocks.loadProgress.mockResolvedValue(NO_PROGRESS.map((entry) => ({ ...entry, state: "locked" })));
    const markup = await renderPage();
    expect(markup).toContain("No level is open yet.");
    expect(markup).not.toContain("practices done");
    expect(markup).not.toContain('type="submit"');
  });

  it("a passed level with nothing active: its panel, header Passed", async () => {
    mocks.loadProgress.mockResolvedValue(NO_PROGRESS.map((entry) => (entry.number === 1 ? { ...entry, state: "passed" } : entry)));
    expect(await renderPage()).toContain("Level 1 · Passed");
  });

  it("a failed read: the first-load message with Try again, no panel, counts or Start", async () => {
    mocks.loadProgress.mockResolvedValue("failed");
    const markup = await renderPage();
    expect(markup).toMatch(new RegExp(`<p role="alert" lang="id">${shellMessages.firstLoadFailed}</p>`));
    expect(markup).toMatch(/<a href="\/levels"[^>]*>Try again<\/a>/);
    expect(markup).not.toContain("practices done");
    expect(markup).not.toContain('type="submit"');
    expect(markup).toContain("Level Map</h1>");
  });
});

describe("/levels — Level Map, Skip intro and the Scroll Scene", () => {
  afterEach(() => mocks.loadProgress.mockResolvedValue(NO_PROGRESS));

  it("'Skip intro' is the first focusable element and jumps to the real Level Path", () => {
    const first = html.match(/<(a|button|input|select|textarea)\b[^>]*>/)?.[0] ?? "";
    expect(first).toContain('href="#level-path"');
    expect(html).toMatch(/<a href="#level-path"[^>]*>Skip intro<\/a>/);
    expect(html).toMatch(/<nav id="level-path" tabindex="-1" aria-label="Level path"/i);
  });

  it("the scene is a decorative copy (aria-hidden, inert) in its static end frame markup, nodes lit to the active level", async () => {
    const at = (itemId: string, score = 90) => ({ id: itemId, itemId, score, startedAt: "2026-11-02T01:00:00Z", receivedAt: "2026-11-02T01:10:00Z" });
    mocks.loadProgress.mockResolvedValue(levelProgress([at("L01-P1")], levels));
    const markup = await renderPage();
    const scene = markup.match(/<div aria-hidden="true" inert="" data-scene="level-map"[\s\S]*?<\/svg>[\s\S]*?<\/div><\/div><\/div><\/div>/)?.[0] ?? "";
    expect(scene).not.toBe("");
    expect(scene).not.toMatch(/<(a|button|input)\b/);
    expect(scene.match(/data-lit="true"/g)).toHaveLength(1);
    expect(scene.match(/data-lit="false"/g)).toHaveLength(8);
    for (const part of ["laptop", "lid", "xl", "board", "trail", "nodes"]) expect(scene).toContain(`data-lm="${part}"`);
    // The scene comes before the map; the map, counts and panel are always in the DOM.
    expect(markup.indexOf('data-scene="level-map"')).toBeLessThan(markup.indexOf('aria-label="Level path"'));
    expect(markup).toContain("1/5 practices done");
  });

  it("a failed read: no scene and no Skip intro", async () => {
    mocks.loadProgress.mockResolvedValue("failed");
    const markup = await renderPage();
    expect(markup).not.toContain("data-scene");
    expect(markup).not.toContain("Skip intro");
  });
});
