"use client";

import type { CSSProperties } from "react";
import { useMotionPreference } from "@/hooks/use-motion-preference";

/** Five flames (left, width, height, delay), from the `key-results.html` mockup. */
const FLAMES: readonly { x: string; w: string; h: string; d: string }[] = [
  // Heights are the mockup's 120/190/230/180/130px of its 250px box, so they scale with the box on phones.
  { x: "6%", w: "58px", h: "48%", d: "0.05s" },
  { x: "22%", w: "70px", h: "76%", d: "0.15s" },
  { x: "40%", w: "78px", h: "92%", d: "0s" },
  { x: "58%", w: "66px", h: "72%", d: "0.2s" },
  { x: "74%", w: "56px", h: "52%", d: "0.1s" },
];

/**
 * Fire Effect (DESIGN.md, Test passed only): plays once behind the Score
 * Badge, CSS only (`globals.css`). Decorative: `aria-hidden`, no pointer
 * events, nothing focusable. Not rendered at all under reduced motion, nor on
 * the server or during hydration.
 */
export function FireEffect() {
  if (useMotionPreference() !== "full") return null;
  return (
    <div aria-hidden="true" data-slot="fire-effect">
      <span data-fire="haze" />
      {FLAMES.map((flame, i) => (
        <span key={i} data-fire="flame" style={{ "--x": flame.x, "--w": flame.w, "--h": flame.h, "--d": flame.d } as CSSProperties} />
      ))}
    </div>
  );
}
