import { unstable_rethrow } from "next/navigation";
import { findOpenAttempt, type Attempt } from "../../adapters/supabase/attempts";
import { getSessionUser } from "../../adapters/supabase/auth";
import { createClient } from "../../adapters/supabase/server";
import { itemLabel } from "../../core/content/level-module";
import { elapsedSeconds } from "../../core/services/attempts";
import { findItem } from "../../content/levels";
import { formatElapsed } from "./exam/[attemptId]/exam-time";

/** The user's attempt in progress as read at render, with the server's seconds since Start (AD-8). */
export interface OpenAttempt {
  attempt: Attempt;
  elapsed: number;
}

/** What the Attempt Card shows (DESIGN.md › Attempt Card, `key-dashboard.html`). */
export interface AttemptCardView {
  /** "Practice 1 · Level 1" (DESIGN.md › Attempt Card); the item id when the item is unknown. */
  title: string;
  /** The time since Start in `stat-value` while open ("12:34"); `null` once received. */
  time: string | null;
  /** After `time`: "since Start" while open; "File received — grading…" once received (as on the exam screen). */
  caption: string;
  /** The exam screen of this attempt; no `?download=1`, so returning on the laptop downloads nothing. */
  resumeHref: string;
}

/**
 * Server only: the session user's attempt in progress (`open`, `received`,
 * `grading_failed`) through their session (RLS, AD-9) — the one read the
 * Dashboard's Attempt Card and the /levels Start lock share. `null` without
 * one (or without a session: the proxy sends those to Login, and Start's
 * action redirects); `"failed"` when the database could not answer (already
 * logged) or anything threw.
 */
export async function loadOpenAttempt(): Promise<OpenAttempt | null | "failed"> {
  try {
    const user = await getSessionUser();
    if (!user) return null;
    const read = await findOpenAttempt(await createClient(), user.id);
    if (!read.ok) return "failed";
    if (read.value === null) return null;
    const attempt = read.value;
    // After the session read: request time, so the page is dynamic.
    const elapsed = elapsedSeconds(attempt.startedAt, Date.now());
    return { attempt, elapsed };
  } catch (error) {
    // Next's own interrupts (prerender, redirect) are not failures.
    unstable_rethrow(error);
    console.error(JSON.stringify({ event: "attempt.load_open_failed", name: (error as Error)?.name ?? "unknown" }));
    return "failed";
  }
}

/** "Practice 1 · Level 1": the item, then its level (mockup order). */
export function attemptTitle(itemId: string): string {
  const found = findItem(itemId);
  return found ? `${itemLabel(found.item)} · Level ${found.level.number}` : itemId;
}

/** The Attempt Card's text and link for an attempt in progress with `elapsed` seconds since Start. */
export function attemptCardView(attempt: Pick<Attempt, "id" | "itemId" | "status">, elapsed: number): AttemptCardView {
  const time = attempt.status === "open" ? formatElapsed(elapsed) : null;
  return {
    title: attemptTitle(attempt.itemId),
    caption: time === null ? "File received — grading…" : "since Start",
    time,
    resumeHref: `/exam/${attempt.id}`,
  };
}
