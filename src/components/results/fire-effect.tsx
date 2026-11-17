"use client";

import type { CSSProperties } from "react";
import { usePlayOnce } from "./use-play-once";

/** Five flames (left, width, height, delay), from the `key-results.html` mockup. */
const FLAMES: readonly { x: string; w: string; h: string; d: string }[] = [
  // The mockup's px of its 250px box as percentages, so the flames scale with the box and stay inside it.
  { x: "6%", w: "23%", h: "48%", d: "0.05s" },
  { x: "22%", w: "28%", h: "76%", d: "0.15s" },
  { x: "40%", w: "31%", h: "92%", d: "0s" },
  { x: "58%", w: "26%", h: "72%", d: "0.2s" },
  { x: "74%", w: "22%", h: "52%", d: "0.1s" },
];

/**
 * Fire Effect (DESIGN.md, Test passed only): plays once behind the Score
 * Badge, CSS only (`globals.css`). Decorative: `aria-hidden`, no pointer
 * events, nothing focusable. Not rendered at all under reduced motion, nor on
 * the server or during hydration; plays once per mount (`usePlayOnce`).
 */
export function FireEffect() {
  if (!usePlayOnce(true)) return null;
  return (
    <div aria-hidden="true" data-slot="fire-effect">
      <span data-fire="haze" />
      {FLAMES.map((flame, i) => (
        <span key={i} data-fire="flame" style={{ "--x": flame.x, "--w": flame.w, "--h": flame.h, "--d": flame.d } as CSSProperties} />
      ))}
    </div>
  );
}

/** The faint `streak-glow` panel tint of a Test passed: with full motion only, like the fire (absent on the server and under reduced motion). */
export function FireTint() {
  if (!usePlayOnce(true)) return null;
  return <div aria-hidden="true" data-slot="fire-tint" />;
}
