import type { LevelItemKind } from "@/core/content/level-module";
import { isPassingScore, type Result } from "@/core/grading/result";

/**
 * What the Results screen says about a stored `Result`, as plain text (CAP-5):
 * the outcome is always in the `<h1>`, never only in a colour or a glow.
 */

/** `pass`: score ≥ 80 (a practice, or a Test passed). `calm`: below 80, shown without glow or red mood. */
export type ResultsVariant = "pass" | "calm";

export interface ResultsOutcome {
  variant: ResultsVariant;
  /** The `<h1>` and, through `surfaceTitle`, the document title. */
  heading: string;
}

/** The registry's view of the item; `null` when no level has `itemId`. */
export type OutcomeItem = { kind: LevelItemKind; number: number } | null;

export function resultsOutcome({ item, itemId, result }: { item: OutcomeItem; itemId: string; result: Pick<Result, "score"> }): ResultsOutcome {
  const passed = isPassingScore(result.score);
  const score = `${result.score}/100`;
  const variant: ResultsVariant = passed ? "pass" : "calm";
  if (item === null) return { variant, heading: `${itemId} — ${score}` };
  if (item.kind === "practice") return { variant, heading: `Practice ${item.number} — ${score}` };
  return { variant, heading: passed ? `Test passed — ${score}` : `Test not passed — ${score}, needs 80` };
}

/** The deduction line under the Score Badge: its label and, with hints, the points taken (shown in `warning`). */
export function deductionParts(result: Pick<Result, "hintsUsed" | "hintPenalty">): { label: string; penalty: string | null } {
  if (result.hintsUsed <= 0) return { label: "No hints", penalty: null };
  return { label: `Hint ×${result.hintsUsed}`, penalty: `−${result.hintPenalty}` };
}

/** "No hints", or "Hint ×3 −15". */
export function deductionText(result: Pick<Result, "hintsUsed" | "hintPenalty">): string {
  const { label, penalty } = deductionParts(result);
  return penalty === null ? label : `${label} ${penalty}`;
}

/** The label before the level's (Indonesian) name: "Level 1 — " or "Test · Level 1 — ". */
export function levelLabelLead(levelNumber: number, kind: LevelItemKind): string {
  return `${kind === "test" ? "Test · " : ""}Level ${levelNumber} — `;
}

/** "Level 1 — Fondasi" / "Test · Level 1 — Fondasi". */
export function levelLabel(level: { number: number; name: string }, kind: LevelItemKind): string {
  return `${levelLabelLead(level.number, kind)}${level.name}`;
}

/** The keys of one shortcut: "Ctrl+Shift+%" → ["Ctrl", "Shift", "%"] (`SHORTCUT_RE` never has `+` as a key). */
export function shortcutKeys(shortcut: string): string[] {
  return shortcut.split("+").filter((key) => key.length > 0);
}
