// @vitest-environment jsdom
import "@/test/dom";
import { screen, within } from "@testing-library/react";
import { prerender } from "react-dom/static";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAccount: vi.fn(), redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, unstable_rethrow: () => {} }));
vi.mock("@/adapters/supabase/auth", () => ({ getAccount: mocks.getAccount }));
// The Appearance card's client controls need the preferences provider; not under test here.
vi.mock("@/components/shell/settings-preferences", () => ({ SettingsPreferences: () => null }));

import { shellMessages } from "@/messages/id";
import SettingsPage from "./page";

/** Every Suspense boundary resolved (the account read included), mounted as the document body. */
async function show() {
  const { prelude } = await prerender(<SettingsPage />);
  document.body.innerHTML = await new Response(prelude).text();
}

const streakCard = () => screen.getByRole("region", { name: "Streak" });

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  mocks.getAccount.mockReset();
  document.body.innerHTML = "";
});

describe("Settings in the DOM", () => {
  it("a stored zone: shown in mono with Signed in as and Log out", async () => {
    mocks.getAccount.mockResolvedValue({ email: "user@example.test", timeZone: { ok: true, timeZone: "Asia/Jakarta" } });
    await show();
    const zone = within(streakCard()).getByText("Asia/Jakarta");
    expect(zone.className).toContain("font-mono");
    expect(within(screen.getByRole("region", { name: "Account" })).getByRole("button", { name: "Log out" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it('no zone stored: "Not set", muted, not an error', async () => {
    mocks.getAccount.mockResolvedValue({ email: "user@example.test", timeZone: { ok: true, timeZone: null } });
    await show();
    const notSet = within(streakCard()).getByText("Not set");
    expect(notSet.className).toContain("text-muted-foreground");
    expect(notSet.className).not.toContain("font-mono");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("first load fails: the first-load alert and Try again in the Streak card, Log out still offered, no email", async () => {
    mocks.getAccount.mockRejectedValue(new Error("network"));
    await show();
    const alert = within(streakCard()).getByRole("alert");
    expect(alert.textContent).toBe(shellMessages.firstLoadFailed);
    expect(alert.getAttribute("lang")).toBe("id");
    expect(within(streakCard()).getByRole("link", { name: "Try again" }).getAttribute("href")).toBe("/settings");
    expect(screen.queryByText(/Signed in as/)).toBeNull();
    expect(screen.getByRole("button", { name: "Log out" })).toBeTruthy();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("settings.account_failed"));
  });

  it("the zone read fails (account read ok): the first-load alert, the email still shown", async () => {
    mocks.getAccount.mockResolvedValue({ email: "user@example.test", timeZone: { ok: false } });
    await show();
    expect(within(streakCard()).getByRole("alert").textContent).toBe(shellMessages.firstLoadFailed);
    expect(screen.getByText("user@example.test")).toBeTruthy();
  });
});
