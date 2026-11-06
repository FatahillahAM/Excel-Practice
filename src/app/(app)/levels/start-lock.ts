/**
 * The Start lock, in a module without `"use client"` so Server Components
 * (/levels) read the real values, not client references.
 */

/** EXPERIENCE.md › Attempt Card: the line every other Start shows while an attempt is in progress. */
export const BLOCKED_MESSAGE = "Resume or abandon the attempt in progress first.";

/** Why Start is not offered right now (an attempt in progress); shown under the disabled button. */
export interface StartLock {
  reason: string;
  /** The attempt in progress: the caption links to its exam screen ("Go to the attempt"). */
  attemptId?: string;
}
