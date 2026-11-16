"use client";

import { useEffect } from "react";

/**
 * Moves focus to the Results `<h1>` once the page is shown (EXPERIENCE.md ›
 * Results): the exam screen navigates here by itself, so a keyboard or screen
 * reader user lands on the outcome. Rendered in `live` mode only.
 */
export function ResultsFocus({ targetId }: { targetId: string }) {
  useEffect(() => {
    document.getElementById(targetId)?.focus();
  }, [targetId]);
  return null;
}
