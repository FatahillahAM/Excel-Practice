// @vitest-environment jsdom
import "@/test/dom";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrbitLoader } from "./orbit-loader";

/** `(prefers-reduced-motion: reduce)` answers `reduce`; every other query never matches. */
function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query === "(prefers-reduced-motion: reduce)",
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}

const orbit = (container: HTMLElement) => container.querySelector("svg.orbit")!;

afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.motion;
});

describe("Orbit Loader in the DOM", () => {
  it("pause/play: the button toggles data-paused and its label", async () => {
    stubReducedMotion(false);
    const user = userEvent.setup();
    const { container } = render(<OrbitLoader />);
    expect(orbit(container).getAttribute("aria-hidden")).toBe("true");
    expect(orbit(container).hasAttribute("data-paused")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Pause animation" }));
    expect(orbit(container).hasAttribute("data-paused")).toBe(true);
    const play = screen.getByRole("button", { name: "Play animation" });
    expect(play.getAttribute("title")).toBe("Play animation");

    await user.click(play);
    expect(orbit(container).hasAttribute("data-paused")).toBe(false);
    expect(screen.getByRole("button", { name: "Pause animation" })).toBeTruthy();
  });

  it("OS reduced motion: no pause/play button after hydration", () => {
    stubReducedMotion(true);
    render(<OrbitLoader />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("the Settings switch (data-motion=reduce): no button, and it leaves when the switch turns on", async () => {
    stubReducedMotion(false);
    render(<OrbitLoader />);
    expect(screen.getByRole("button", { name: "Pause animation" })).toBeTruthy();
    await act(async () => {
      document.documentElement.dataset.motion = "reduce";
      await Promise.resolve();
    });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("the server render has no button (static frame first)", () => {
    stubReducedMotion(false);
    expect(renderToString(<OrbitLoader />)).not.toContain("<button");
  });
});
