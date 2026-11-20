// @vitest-environment jsdom
import "@/test/dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/levels" }));

import { fondasi } from "@/content/levels/01-fondasi";
import type { LevelModule } from "@/core/content/level-module";
import { curriculumSummary, levelProgress, type GradedAttempt } from "@/core/progress";
import { SidebarContent } from "./sidebar-content";

const REAL = [fondasi as unknown as LevelModule];
const at = (itemId: string, score: number): GradedAttempt => ({ id: `${itemId}-${score}`, itemId, score, startedAt: "2026-11-02T01:00:00Z", receivedAt: "2026-11-02T01:10:00Z" });
const summaryOf = (attempts: GradedAttempt[]) => curriculumSummary(levelProgress(attempts, REAL));

const levelMap = () => screen.getByRole("link", { name: /Level Map/ });
const badge = () => document.querySelector<HTMLElement>('[data-slot="nav-badge"]');

describe("SidebarContent curriculum count", () => {
  it("new user: Level Map badge L1, footer 0 of 9 levels passed", () => {
    render(<SidebarContent idPrefix="t" summary={summaryOf([])} />);
    expect(badge()!.textContent).toContain("L1");
    expect(levelMap().textContent).toContain("Level 1");
    expect(screen.getByText("0 of 9 levels passed")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Levels passed" }).getAttribute("aria-valuenow")).toBe("0");
  });

  it("L01-T passed (80): 1 of 9 levels passed; 79 stays 0 of 9", () => {
    const { unmount } = render(<SidebarContent idPrefix="t" summary={summaryOf([at("L01-T", 80)])} />);
    expect(screen.getByText("1 of 9 levels passed")).toBeTruthy();
    expect(badge()!.textContent).toContain("L1");
    unmount();
    render(<SidebarContent idPrefix="t" summary={summaryOf([at("L01-T", 79)])} />);
    expect(screen.getByText("0 of 9 levels passed")).toBeTruthy();
  });

  it("shows the active level once Level 2 opens", () => {
    render(<SidebarContent idPrefix="t" summary={{ activeLevel: 2, passed: 1, total: 9 }} />);
    expect(badge()!.textContent).toContain("L2");
  });

  it("without a summary (progress failed to load): no badge, no footer", () => {
    render(<SidebarContent idPrefix="t" />);
    expect(badge()).toBeNull();
    expect(screen.queryByText(/levels passed/)).toBeNull();
  });
});
