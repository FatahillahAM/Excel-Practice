"use client";

import { Pause, Play } from "lucide-react";
import { useState } from "react";
import { useMotionPreference } from "@/hooks/use-motion-preference";

/**
 * Rings outer → inner (DESIGN.md › Orbit Loader, EXPERIENCE.md › Interaction
 * Primitives › Orbit): radius, ring stroke opacity, one dot's period and its
 * start angle (clockwise from 12 o'clock).
 */
const RINGS = [
  { r: 49, opacity: 0.02, period: 44, start: 0 },
  { r: 40, opacity: 0.03, period: 40, start: 90 },
  { r: 30, opacity: 0.04, period: 36, start: 180 },
  { r: 20, opacity: 0.04, period: 14, start: 0 },
  { r: 15, opacity: 0.08, period: 16, start: 270 },
  { r: 10, opacity: 0.1, period: 15, start: 90 },
] as const;

/**
 * Orbit Loader: the calm focal point while Excel is in use. Inline SVG with
 * CSS keyframes only (AD-12), decorative (`aria-hidden`). Reduced motion (OS
 * or Settings) stops every dot at its start angle through the global rule in
 * `globals.css`, and the pause/play button is not rendered; it also is not
 * rendered on the server and during hydration (`useMotionPreference`), and
 * sits `absolute` so it appears without moving the layout.
 */
export function OrbitLoader() {
  const motion = useMotionPreference();
  const [paused, setPaused] = useState(false);
  const label = paused ? "Play animation" : "Pause animation";

  return (
    <div className="relative aspect-square w-full max-w-[320px]">
      <svg
        viewBox="0 0 100 100"
        aria-hidden="true"
        focusable="false"
        className="orbit block size-full text-foreground"
        data-paused={paused ? "" : undefined}
      >
        {RINGS.map((ring) => (
          <circle
            key={ring.r}
            cx="50"
            cy="50"
            r={ring.r}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.3"
            strokeOpacity={ring.opacity}
          />
        ))}
        {RINGS.map((ring) => (
          <g key={ring.r} className="orbit-path" style={{ animationDuration: `${ring.period}s` }}>
            <g transform={`rotate(${ring.start} 50 50)`}>
              <circle cx="50" cy={50 - ring.r} r="0.75" className="fill-foreground stroke-border" strokeWidth="0.15" />
            </g>
          </g>
        ))}
        <circle cx="50" cy="50" r="9" className="fill-glow-soft" />
        <rect x="43.75" y="43.75" width="12.5" height="12.5" rx="3.4" className="fill-primary" />
        {/* The app logo glyph (LogoTile), ≤ 40px at 320px. */}
        <svg x="45.6" y="45.6" width="8.8" height="8.8" viewBox="0 0 24 24">
          <g
            fill="none"
            className="stroke-primary-foreground"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M3 9h18M3 15h18M9 3v18" />
          </g>
        </svg>
      </svg>
      {motion === "full" && (
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={label}
          title={label}
          className="absolute right-0 bottom-1.5 grid size-8 place-items-center rounded-[10px] border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {paused ? <Play aria-hidden="true" className="size-4" /> : <Pause aria-hidden="true" className="size-4" />}
        </button>
      )}
    </div>
  );
}
