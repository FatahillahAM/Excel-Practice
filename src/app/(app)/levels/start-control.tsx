"use client";

import { useActionState, useEffect, useRef } from "react";
import { startMessages } from "@/messages/id";
import { startAttempt, type StartState } from "./start-actions";

const INITIAL: StartState = { status: "idle" };

/** EXPERIENCE.md › Attempt Card: the line every other Start shows while an attempt is in progress. */
export const BLOCKED_MESSAGE = "Resume or abandon the attempt in progress first.";

/**
 * "Start Practice N" (CAP-2): posts the item and the browser's time zone (for
 * a profile that does not exist yet) to the Start action, which moves on to
 * the exam screen. Disabled while pending; every failure lands in the one
 * inline slot under the button.
 */
export function StartControl({ itemId, label }: { itemId: string; label: string }) {
  const [state, formAction, pending] = useActionState(startAttempt, INITIAL);
  const timeZoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      if (timeZoneRef.current) timeZoneRef.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    } catch {
      // No zone: the action asks for a reload instead of storing a guess.
    }
  }, []);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="itemId" value={itemId} />
      <input ref={timeZoneRef} type="hidden" name="timeZone" defaultValue="" />
      <button
        type="submit"
        disabled={pending}
        aria-describedby={`start-${itemId}-message`}
        className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-md bg-primary px-[18px] font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:self-start"
      >
        {pending ? "Starting…" : `Start ${label}`}
      </button>
      <div id={`start-${itemId}-message`} role="alert" className="min-h-5 text-xs leading-[1.4] font-medium">
        {state.status === "error" && (
          <span lang="id" className="text-destructive">
            {startMessages[state.error]}
          </span>
        )}
        {state.status === "blocked" && (
          <span>
            {BLOCKED_MESSAGE}
            {state.attemptId && (
              <>
                {" "}
                <a
                  href={`/exam/${state.attemptId}`}
                  className="font-bold text-primary underline-offset-4 hover:underline"
                >
                  Go to the attempt
                </a>
              </>
            )}
          </span>
        )}
      </div>
    </form>
  );
}
