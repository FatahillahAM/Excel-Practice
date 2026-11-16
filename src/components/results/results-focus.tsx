"use client";

import { useEffect } from "react";

/**
 * Moves focus to the Results `<h1>` once the page is shown (EXPERIENCE.md ›
 * Results): the exam screen navigates here by itself, so a keyboard or screen
 * reader user lands on the outcome. Rendered in `live` mode only.
 *
 * Without scrolling, and not when the URL has a fragment (`#tip-2`: the
 * browser already went there) or when focus is already on something inside
 * the page (the user moved it before hydration).
 */
export function ResultsFocus({ targetId }: { targetId: string }) {
  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    if (window.location.hash.length > 1) return;
    const active = document.activeElement;
    const page = target.closest("main");
    if (active && active !== document.body && active !== target && page?.contains(active)) return;
    target.focus({ preventScroll: true });
  }, [targetId]);
  return null;
}
