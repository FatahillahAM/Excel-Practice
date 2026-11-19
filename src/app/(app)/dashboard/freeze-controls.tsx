"use client";

import { unstable_rethrow, useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { streakMessages } from "@/messages/id";
import { freezeToday, type FreezeState } from "./freeze-actions";

const INITIAL: FreezeState = { status: "idle" };
const MINUTE = 60_000;

/** "Xh Ym left" for a duration in ms (minutes rounded down). */
export function timeLeftLabel(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / MINUTE));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m left`;
}

/**
 * The Streak Risk Pill's text: the server's time left until 00:00 local,
 * then counted down once a minute in place; at 0 (local midnight) the page
 * is refreshed from the server, which decides the new day. Not a live
 * region: the countdown is never announced.
 */
export function RiskCountdown({ msLeft }: { msLeft: number }) {
  const router = useRouter();
  const [left, setLeft] = useState(msLeft);
  useEffect(() => {
    const started = Date.now();
    let refreshed = false;
    const tick = () => {
      const next = Math.max(0, msLeft - (Date.now() - started));
      setLeft(next);
      if (next === 0 && !refreshed) {
        refreshed = true;
        window.clearInterval(interval);
        router.refresh();
      }
    };
    const interval = window.setInterval(tick, MINUTE);
    // The last stretch ends exactly at midnight, not at the next whole minute.
    const rollover = window.setTimeout(tick, msLeft);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(rollover);
    };
  }, [msLeft, router]);
  return <>{timeLeftLabel(left)}</>;
}

const REFUSED: Record<"safe" | "quota_used" | "day_changed", string> = {
  safe: streakMessages.alreadySafe,
  quota_used: streakMessages.quotaUsed,
  day_changed: streakMessages.dayChanged,
};

/**
 * Use freeze: posts to `freezeToday` with the day this page showed as today
 * (the server decides whether it still is). While pending: "Freezing…",
 * disabled. With no freeze left this week the button stays focusable but
 * `aria-disabled`, its reason in `aria-describedby`, and posts nothing.
 * `quiet` de-emphasises it (streak 0).
 */
export function UseFreezeButton({ left, today, quiet = false }: { left: number; today: string; quiet?: boolean }) {
  const [state, formAction, pending] = useActionState(async (_previous: FreezeState, formData: FormData): Promise<FreezeState> => {
    try {
      return await freezeToday(formData);
    } catch (error) {
      unstable_rethrow(error);
      return { status: "error" };
    }
  }, INITIAL);

  const exhausted = left <= 0;
  const reasonId = useId();
  const message =
    state.status === "refused"
      ? REFUSED[state.reason]
      : exhausted
        ? streakMessages.quotaUsed
        : state.status === "error"
          ? streakMessages.freezeFailed
          : null;

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="expectedDate" value={today} />
      <button
        type={exhausted ? "button" : "submit"}
        disabled={pending}
        aria-disabled={exhausted ? true : undefined}
        aria-describedby={message ? reasonId : undefined}
        className={cn(
          "inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-bold",
          quiet
            ? "border border-border bg-transparent text-muted-foreground"
            : "bg-primary text-primary-foreground",
          (exhausted || pending) && "cursor-not-allowed opacity-60",
        )}
      >
        {pending ? "Freezing…" : "Use freeze"}
      </button>
      <p id={reasonId} role={exhausted && state.status === "idle" ? undefined : "alert"} lang="id" className="min-h-4 text-xs leading-[1.4] font-medium text-muted-foreground">
        {message}
      </p>
    </form>
  );
}
