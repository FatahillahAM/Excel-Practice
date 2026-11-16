import { cn } from "@/lib/utils";
import type { ResultsVariant } from "./outcome";

/**
 * Score Badge (DESIGN.md › Score Badge): a 168px disc with the score in
 * `display-lg` and "/100" in `label`. Static: `pass` in `live` mode has the
 * `primary` face with a `glow-strong` shadow; `calm`, and any score in
 * `static` mode (History), is flat `muted` with a 2px `input-border` ring.
 * Decorative (`aria-hidden`): the score is in the page's `<h1>`.
 * `data-variant` and `data-mode` are the hooks for the Results motion.
 */
export function ScoreBadge({ score, variant, mode }: { score: number; variant: ResultsVariant; mode: "live" | "static" }) {
  const glowing = variant === "pass" && mode === "live";
  return (
    <div
      aria-hidden="true"
      data-slot="score-badge"
      data-variant={variant}
      data-mode={mode}
      data-glow={glowing ? "true" : "false"}
      className={cn(
        "grid size-[168px] shrink-0 place-items-center rounded-full",
        glowing
          ? "bg-primary text-primary-foreground shadow-[0_0_28px_var(--glow-strong),0_30px_40px_rgba(0,0,0,0.45)]"
          : "bg-muted text-foreground shadow-[inset_0_0_0_2px_var(--input-border)]",
      )}
    >
      <div className="text-center">
        <span className="block font-display text-[56px] leading-none font-extrabold tracking-[-0.05em] tabular-nums">{score}</span>
        <span className="mt-1 block font-mono text-[11px] leading-[1.2] font-bold tracking-[0.1em] opacity-75">/100</span>
      </div>
    </div>
  );
}
