import type { LevelItemKind } from "@/core/content/level-module";
import { PASS_SCORE, isPassingScore, type Result } from "@/core/grading/result";

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

/** The item when it is one Results knows how to name (a practice or a Test); `null` otherwise, shown by its id. */
export function knownItem(item: OutcomeItem): OutcomeItem {
  return item !== null && (item.kind === "practice" || item.kind === "test") ? item : null;
}

export function resultsOutcome({ item, itemId, result }: { item: OutcomeItem; itemId: string; result: Pick<Result, "score"> }): ResultsOutcome {
  const passed = isPassingScore(result.score);
  const score = `${result.score}/100`;
  const variant: ResultsVariant = passed ? "pass" : "calm";
  const known = knownItem(item);
  if (known === null) return { variant, heading: `${itemId} — ${score}` };
  if (known.kind === "practice") return { variant, heading: `Practice ${known.number} — ${score}` };
  return { variant, heading: passed ? `Test passed — ${score}` : `Test not passed — ${score}, needs ${PASS_SCORE}` };
}

type Deducted = Pick<Result, "hintsUsed" | "pointsEarned" | "score">;

/**
 * The deduction line under the Score Badge: its label and, with hints, the
 * points actually taken (shown in `warning`): `pointsEarned − score`, which is
 * 5 × hints unless the floor at 0 took less (10 earned, 3 hints → −10).
 */
export function deductionParts(result: Deducted): { label: string; penalty: string | null } {
  if (result.hintsUsed <= 0) return { label: "No hints", penalty: null };
  return { label: `Hint ×${result.hintsUsed}`, penalty: `−${Math.max(0, result.pointsEarned - result.score)}` };
}

/** "No hints", or "Hint ×3 −15". */
export function deductionText(result: Deducted): string {
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

/** Which Results motion may play, before the motion preference (AD-12). */
export interface ResultsMotion {
  /** The Score Badge turn and the score count-up. */
  turn: boolean;
  /** The Fire Effect behind the badge (a Test passed). */
  fire: boolean;
  /** The scroll scene of the sections below the Outcome panel. */
  scene: boolean;
}

/**
 * Pure motion gate: `turn` and `scene` in `live` mode for a `pass` (the same
 * condition as the badge's `data-glow="true"`); `fire` also needs a Test.
 * `kind` is `knownItem(item)?.kind ?? null`; `null` only blocks the fire.
 */
export function resultsMotion({ variant, kind, mode }: { variant: ResultsVariant; kind: LevelItemKind | null; mode: "live" | "static" }): ResultsMotion {
  const moving = mode === "live" && variant === "pass";
  return { turn: moving, fire: moving && kind === "test", scene: moving };
}
