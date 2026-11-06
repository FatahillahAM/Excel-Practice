"use client";

import { Play } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { cn } from "../../../lib/utils";
import { startMessages } from "../../../messages/id";
import { startAttempt, type StartState } from "./start-actions";
import { BLOCKED_MESSAGE, type StartLock } from "./start-lock";

const INITIAL: StartState = { status: "idle" };

/**
 * "Start Practice N" (CAP-2): posts the item and the browser's time zone (for
 * a profile that does not exist yet) to the Start action, which moves on to
 * the exam screen. Disabled while pending; every failure lands in the one
 * inline slot under the button. With `lock`, the Primary Button is
 * `aria-disabled` (DESIGN.md › Primary Button: muted fill, no edge, no glow),
 * stays focusable so its reason (a caption under it, in `aria-describedby`) is
 * read, and never submits; with `lock.attemptId` the caption adds "Go to the
 * attempt", as the `blocked` slot does. `fullWidth` fills its container at every width
 * (Level Detail Panel foot).
 */
export function StartControl({
  itemId,
  label,
  lock,
  fullWidth = false,
}: {
  itemId: string;
  label: string;
  lock?: StartLock;
  fullWidth?: boolean;
}) {
  const [state, formAction, pending] = useActionState(startAttempt, INITIAL);
  const timeZoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      if (timeZoneRef.current) timeZoneRef.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    } catch {
      // No zone: the action asks for a reload instead of storing a guess.
    }
  }, []);

  const messageId = `start-${itemId}-message`;
  const lockId = `start-${itemId}-lock`;

  return (
    <form
      action={lock ? undefined : formAction}
      onSubmit={lock ? (event) => event.preventDefault() : undefined}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="itemId" value={itemId} />
      <input ref={timeZoneRef} type="hidden" name="timeZone" defaultValue="" />
      <button
        type="submit"
        disabled={!lock && pending}
        aria-disabled={lock ? true : undefined}
        onClick={lock ? (event) => event.preventDefault() : undefined}
        aria-describedby={lock ? `${lockId} ${messageId}` : messageId}
        className={cn(
          "mb-1 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md px-[18px] font-bold transition-[transform,box-shadow,opacity] disabled:cursor-not-allowed",
          !fullWidth && "sm:w-auto sm:self-start",
          lock
            ? "mb-0 cursor-not-allowed bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground shadow-[0_4px_0_0_var(--primary-edge)] hover:shadow-[0_4px_0_0_var(--primary-edge),0_0_0_4px_var(--glow-soft)] active:translate-y-[2px] active:shadow-[0_2px_0_0_var(--primary-edge)] disabled:translate-y-0 disabled:opacity-60",
        )}
      >
        <Play aria-hidden="true" className="size-4 fill-current stroke-none" />
        {pending ? "Starting…" : `Start ${label}`}
      </button>
      {lock && (
        <p id={lockId} className="text-xs leading-[1.4] font-medium text-muted-foreground">
          {lock.reason}
          {lock.attemptId && (
            <>
              {" "}
              <AttemptLink attemptId={lock.attemptId} />
            </>
          )}
        </p>
      )}
      <div id={messageId} role="alert" className="min-h-5 text-xs leading-[1.4] font-medium">
        {state.status === "error" && (
          <span lang="id" className="text-destructive">
            {startMessages[state.error]}
          </span>
        )}
        {!lock && state.status === "blocked" && (
          <span>
            {BLOCKED_MESSAGE}
            {state.attemptId && (
              <>
                {" "}
                <AttemptLink attemptId={state.attemptId} />
              </>
            )}
          </span>
        )}
      </div>
    </form>
  );
}

/** "Go to the attempt": the exam screen of the attempt in progress. */
function AttemptLink({ attemptId }: { attemptId: string }) {
  return (
    <a href={`/exam/${attemptId}`} className="font-bold text-primary underline-offset-4 hover:underline">
      Go to the attempt
    </a>
  );
}
