import Link from "next/link";
import { PageTitle } from "@/components/shell/page-title";
import type { LevelItemKind } from "@/core/content/level-module";
import type { Result } from "@/core/grading/result";
import { formatElapsed } from "@/core/services/attempts/elapsed";
import { cn } from "@/lib/utils";
import { FireEffect, FireTint } from "./fire-effect";
import { deductionParts, knownItem, levelLabelLead, resultsMotion, resultsOutcome } from "./outcome";
import { ResultsDetails } from "./results-details";
import { ResultsFocus } from "./results-focus";
import { ScoreBadge } from "./score-badge";

export const RESULTS_HEADING_ID = "results-heading";

/**
 * The ≥ 80 Outcome panel (mockup, P2): a `glow-soft` radial tint behind the
 * badge and a `glow` border on hover. Static: only the `live` panel eases the
 * border (and not under reduced motion); nothing else moves.
 */
export const PASS_PANEL = "bg-[radial-gradient(ellipse_60%_80%_at_18%_50%,var(--glow-soft),transparent_70%)] hover:border-glow";

export interface ResultsViewProps {
  itemId: string;
  /** The registry's item; `null` when no level has `itemId`. */
  item: { kind: LevelItemKind; number: number } | null;
  /** The item's level (number and Indonesian name); `null` with an unknown item. */
  level: { number: number; name: string } | null;
  result: Result;
  /** `received_at − started_at` in seconds; `null` hides the time. */
  durationSeconds: number | null;
  /** "New record" next to the time (4.4, `isNewRecord`); only shown with a time. */
  newRecord?: boolean;
  /** `live`: the Results page (focus moves to the `<h1>`). `static`: opened from History (flat badge, focus untouched). */
  mode: "live" | "static";
}

/**
 * The Results screen (EXPERIENCE.md › Results, CAP-5, CAP-8), rendered from
 * the stored `Result` only (AD-3): Outcome panel (static Score Badge with the
 * deduction line, level label, the `<h1>` that states the outcome, "x of y
 * correct", time), then the Wrong Answer Rows and the Tips Carousel. The
 * variant comes from the item kind and the score alone. Motion (3.7) is
 * gated by `resultsMotion` and played by CSS: the badge turn, the scroll
 * scene below, and for a Test passed the Fire Effect behind the badge. A
 * score ≥ 80 tints the panel (`PASS_PANEL`); `newRecord` adds the
 * "New record" badge beside the time.
 */
export function ResultsView({ itemId, item, level, result, durationSeconds, newRecord = false, mode }: ResultsViewProps) {
  const { variant, heading } = resultsOutcome({ item, itemId, result });
  const deduction = deductionParts(result);
  const known = knownItem(item);
  const motion = resultsMotion({ variant, kind: known?.kind ?? null, mode });

  return (
    <div data-slot="results" data-variant={variant} data-mode={mode} data-kind={known?.kind ?? "unknown"} className="mx-auto flex w-full max-w-[880px] flex-col gap-7">
      <section
        aria-labelledby={RESULTS_HEADING_ID}
        data-slot="outcome-panel"
        className={cn(
          "grid items-center gap-6 rounded-lg border border-border bg-card p-5 sm:grid-cols-[200px_1fr] sm:gap-7 sm:px-8 sm:py-7",
          variant === "pass" && PASS_PANEL,
          variant === "pass" && mode === "live" && "transition-[border-color] duration-200 motion-reduce:transition-none",
          motion.fire && "relative",
        )}
      >
        {motion.fire ? <FireTint /> : null}
        <div className={cn("flex flex-col items-center gap-2.5", motion.fire && "relative")}>
          {motion.fire ? <FireEffect /> : null}
          <ScoreBadge score={result.score} variant={variant} mode={mode} turn={motion.turn} />
          <p data-slot="deduction" className={cn("flex flex-wrap justify-center gap-x-1.5 text-[12px] font-medium text-muted-foreground", motion.fire && "relative")}>
            <span>{deduction.label}</span>
            {deduction.penalty !== null ? (
              <>
                {" "}
                <span className="font-mono font-bold text-warning">{deduction.penalty}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className={cn("flex min-w-0 flex-col items-center gap-3 text-center sm:items-start sm:text-left", motion.fire && "relative")}>
          <p data-slot="level-label" className="font-mono text-[11px] leading-[1.2] font-bold tracking-[0.1em] text-muted-foreground uppercase">
            {known !== null && level !== null ? (
              <>
                {levelLabelLead(level.number, known.kind)}
                <span lang="id">{level.name}</span>
              </>
            ) : (
              itemId
            )}
          </p>
          <PageTitle id={RESULTS_HEADING_ID} tabIndex={-1} className="[overflow-wrap:anywhere]">
            {heading}
          </PageTitle>
          <div className="flex flex-wrap items-baseline justify-center gap-x-[18px] gap-y-2.5 sm:justify-start">
            <p data-slot="correct-count">
              <span className="font-mono text-[26px] font-extrabold tracking-[-0.04em] text-success tabular-nums">{result.correctCount}</span>{" "}
              <span className="text-[13px] text-muted-foreground">{`of ${result.questionCount} correct`}</span>
            </p>
            {durationSeconds !== null ? (
              <p data-slot="time">
                <span className="font-mono text-[26px] font-extrabold tracking-[-0.04em] tabular-nums">{formatElapsed(durationSeconds)}</span>{" "}
                <span className="text-[13px] text-muted-foreground">time</span>
                {newRecord ? (
                  <>
                    {" "}
                    <span
                      data-slot="new-record"
                      className="ml-1 inline-flex items-center rounded-full bg-glow-soft px-2 py-0.5 align-middle font-mono text-[11px] leading-[1.2] font-bold tracking-[0.1em] text-primary uppercase"
                    >
                      New record
                    </span>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          <Link href="/dashboard" className="font-bold text-primary underline-offset-4 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </section>

      <ResultsDetails questions={result.questions} levelNumber={level?.number ?? null} scene={motion.scene} />
      {mode === "live" ? <ResultsFocus targetId={RESULTS_HEADING_ID} /> : null}
    </div>
  );
}
