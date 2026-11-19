"use client";

import { unstable_rethrow } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
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
 * then counted down once a minute in place. Not a live region: the countdown
 * is never announced.
 */
export function RiskCountdown({ msLeft }: { msLeft: number }) {
  const [left, setLeft] = useState(msLeft);
  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => setLeft(Math.max(0, msLeft - (Date.now() - started))), MINUTE);
    return () => window.clearInterval(id);
  }, [msLeft]);
  return <>{timeLeftLabel(left)}</>;
}

/**
 * Use freeze: posts to `freezeToday` (the server decides "today"). While
 * pending: "Freezing…", disabled. With no freeze left this week the button
 * stays focusable but `aria-disabled`, its reason in `aria-describedby`, and
 * posts nothing. `quiet` de-emphasises it (streak 0).
 */
export function UseFreezeButton({ left, quiet = false }: { left: number; quiet?: boolean }) {
  const [state, formAction, pending] = useActionState(async (): Promise<FreezeState> => {
    try {
      return await freezeToday();
    } catch (error) {
      unstable_rethrow(error);
      return { status: "error" };
    }
  }, INITIAL);

  const exhausted = left <= 0;
  const reasonId = "use-freeze-reason";
  const message =
    exhausted || (state.status === "refused" && state.reason === "quota_used")
      ? streakMessages.quotaUsed
      : state.status === "refused"
        ? streakMessages.alreadySafe
        : state.status === "error"
          ? streakMessages.freezeFailed
          : null;

  return (
    <form action={formAction} className="flex flex-col gap-1">
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
      <p id={reasonId} role={exhausted ? undefined : "alert"} lang="id" className="min-h-4 text-xs leading-[1.4] font-medium text-muted-foreground">
        {message}
      </p>
    </form>
  );
}
