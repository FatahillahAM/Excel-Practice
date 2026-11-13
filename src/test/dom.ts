/**
 * DOM test harness (jsdom + Testing Library). Import it first in every DOM
 * test file, before the component under test:
 *
 *   // @vitest-environment jsdom
 *   import "@/test/dom";
 *
 * - The environment is chosen per file with the `// @vitest-environment jsdom`
 *   docblock on the file's first line; every other file keeps the default
 *   `node` environment. Name DOM tests `*.dom.test.tsx`.
 * - Vitest globals are off, so Testing Library cannot register its own
 *   cleanup: this module unmounts after each test (`afterEach(cleanup)`) and
 *   tells React that updates run inside `act()`.
 * - jsdom has no `window.matchMedia` (`useMotionPreference` calls it): a stub
 *   that never matches is installed when it is missing.
 * - Timers: `vi.useFakeTimers()` and `await vi.advanceTimersByTimeAsync(ms)`
 *   inside `act()`, in steps no longer than the shortest timer under test
 *   (state set inside one `act()` re-arms effects only when it ends); with
 *   user-event, `userEvent.setup({ advanceTimers:
 *   vi.advanceTimersByTimeAsync })`.
 * - Testing Library drains microtasks after every user-event call with a
 *   `setTimeout(0)`, and steps it itself only when it finds Jest's fake
 *   timers. Under Vitest's that timer would never fire (the call hangs), so
 *   this module gives it the one `jest` method it asks for.
 * - Radix Select (`components/ui/select.tsx`) calls `hasPointerCapture`,
 *   `releasePointerCapture` and `scrollIntoView`, which jsdom lacks: no-op
 *   stubs are installed when they are missing.
 * - Next: mock `next/navigation` (`useRouter` returning one stable object, so
 *   effects that depend on it do not re-run every render), and `next/link` as
 *   a plain `<a>` if a test renders one that needs router context.
 */
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  cleanup();
});

const globals = globalThis as { jest?: { advanceTimersByTime: (ms: number) => void } };
globals.jest ??= { advanceTimersByTime: (ms) => void vi.advanceTimersByTime(ms) };

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  });
}

if (typeof Element !== "undefined") {
  const proto = Element.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
}
