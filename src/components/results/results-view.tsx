import Link from "next/link";
import { PageTitle } from "@/components/shell/page-title";
import type { LevelItemKind } from "@/core/content/level-module";
import type { Result } from "@/core/grading/result";
import { formatElapsed } from "@/core/services/attempts/elapsed";
import { deductionParts, levelLabelLead, resultsOutcome } from "./outcome";
import { ResultsDetails } from "./results-details";
import { ResultsFocus } from "./results-focus";
import { ScoreBadge } from "./score-badge";

export const RESULTS_HEADING_ID = "results-heading";

export interface ResultsViewProps {
  itemId: string;
  /** The registry's item; `null` when no level has `itemId`. */
  item: { kind: LevelItemKind; number: number } | null;
  /** The item's level (number and Indonesian name); `null` with an unknown item. */
  level: { number: number; name: string } | null;
  result: Result;
  /** `received_at − started_at` in seconds; `null` hides the time. */
  durationSeconds: number | null;
  /** `live`: the Results page (focus moves to the `<h1>`). `static`: opened from History (flat badge, focus untouched). */
  mode: "live" | "static";
}

/**
 * The Results screen (EXPERIENCE.md › Results, CAP-5, CAP-8), rendered from
 * the stored `Result` only (AD-3): Outcome panel (static Score Badge with the
 * deduction line, level label, the `<h1>` that states the outcome, "x of y
 * correct", time), then the Wrong Answer Rows and the Tips Carousel. The
 * variant comes from the item kind and the score alone; nothing here moves
 * (the Results motion hooks on `data-variant` / `data-mode`).
 */
export function ResultsView({ itemId, item, level, result, durationSeconds, mode }: ResultsViewProps) {
  const { variant, heading } = resultsOutcome({ item, itemId, result });
  const deduction = deductionParts(result);

  return (
    <div data-slot="results" data-variant={variant} data-mode={mode} data-kind={item?.kind ?? "unknown"} className="mx-auto flex w-full max-w-[880px] flex-col gap-7">
      <section
        aria-labelledby={RESULTS_HEADING_ID}
        className="grid items-center gap-6 rounded-lg border border-border bg-card p-5 sm:grid-cols-[200px_1fr] sm:gap-7 sm:px-8 sm:py-7"
      >
        <div className="flex flex-col items-center gap-2.5">
          <ScoreBadge score={result.score} variant={variant} mode={mode} />
          <p data-slot="deduction" className="flex flex-wrap justify-center gap-x-1.5 text-[12px] font-medium text-muted-foreground">
            <span>{deduction.label}</span>
            {deduction.penalty !== null ? <span className="font-mono font-bold text-warning">{deduction.penalty}</span> : null}
          </p>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-3 text-center sm:items-start sm:text-left">
          <p data-slot="level-label" className="font-mono text-[11px] leading-[1.2] font-bold tracking-[0.1em] text-muted-foreground uppercase">
            {item !== null && level !== null ? (
              <>
                {levelLabelLead(level.number, item.kind)}
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
              </p>
            ) : null}
          </div>
          <Link href="/dashboard" className="font-bold text-primary underline-offset-4 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </section>

      <ResultsDetails questions={result.questions} levelNumber={level?.number ?? null} />
      {mode === "live" ? <ResultsFocus targetId={RESULTS_HEADING_ID} /> : null}
    </div>
  );
}
