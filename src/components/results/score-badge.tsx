"use client";

import { Flame } from "lucide-react";
import type { CSSProperties } from "react";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { cn } from "@/lib/utils";
import type { ResultsVariant } from "./outcome";

/**
 * Score Badge (DESIGN.md › Score Badge): a 168px disc with the score in
 * `display-lg` and "/100" in `label`. Static: `pass` in `live` mode has the
 * `primary` face with a `glow-strong` shadow; `calm`, and any score in
 * `static` mode (History), is flat `muted` with a 2px `input-border` ring.
 * Decorative (`aria-hidden`): the score is in the page's `<h1>`.
 *
 * Three layers, so the Results motion can turn the disc without moving the
 * glow: the wrapper (never rotates; `data-variant`, `data-mode`, `data-glow`
 * and the glow), the disc, and the face with the colour and the score.
 *
 * Motion (3.7, CSS only): with `turn` and full motion the wrapper gets
 * `data-animate="turn"` and `--score-n`; `globals.css` turns the disc once
 * (showing the `streak` back face) and counts the score up through a
 * pseudo-element. The score's DOM text is always the final value.
 */
export function ScoreBadge({
  score,
  variant,
  mode,
  turn = false,
}: {
  score: number;
  variant: ResultsVariant;
  mode: "live" | "static";
  /** May the badge turn and count up (from `resultsMotion`)? */
  turn?: boolean;
}) {
  const glowing = variant === "pass" && mode === "live";
  const animate = useMotionPreference() === "full" && turn;
  return (
    <div
      aria-hidden="true"
      data-slot="score-badge"
      data-variant={variant}
      data-mode={mode}
      data-glow={glowing ? "true" : "false"}
      data-animate={animate ? "turn" : undefined}
      style={animate ? ({ "--score-n": score } as CSSProperties) : undefined}
      className={cn("size-[168px] shrink-0 rounded-full perspective-[900px]", glowing && "shadow-[0_0_28px_var(--glow-strong),0_30px_40px_rgba(0,0,0,0.45)]")}
    >
      <div data-slot="score-badge-disc" className="relative size-full rounded-full transform-3d">
        <div
          data-slot="score-badge-face"
          className={cn(
            "absolute inset-0 grid place-items-center rounded-full backface-hidden",
            glowing ? "bg-primary text-primary-foreground" : "bg-muted text-foreground shadow-[inset_0_0_0_2px_var(--input-border)]",
          )}
        >
          <div className="text-center">
            <span data-slot="score-badge-score" className="block font-display text-[56px] leading-none font-extrabold tracking-[-0.05em] tabular-nums">{score}</span>
            <span className="mt-1 block font-mono text-[11px] leading-[1.2] font-bold tracking-[0.1em] opacity-75">/100</span>
          </div>
        </div>
        <div
          data-slot="score-badge-back"
          className="absolute inset-0 grid rotate-y-180 place-items-center rounded-full bg-streak text-primary-foreground backface-hidden"
        >
          <Flame aria-hidden="true" className="size-16" strokeWidth={1.6} />
        </div>
      </div>
    </div>
  );
}
