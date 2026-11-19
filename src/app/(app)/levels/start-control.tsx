"use client";

import { Play, RotateCcw } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { phoneStartMessage, startMessages, startRefusedMessages } from "@/messages/id";
import { PRACTICE_COUNT, testLockLine } from "./level-panel";
import { startAttempt, type StartState } from "./start-actions";
import { BLOCKED_MESSAGE, type StartLock } from "./start-lock";

const INITIAL: StartState = { status: "idle" };

/**
 * The device gate (D4): a phone is a coarse pointer below `lg`. CSS, not
 * script, so there is no moment before hydration where the real Start is
 * tappable on a phone; the server does not check the device.
 */
export const PHONE_QUERY = "(pointer: coarse) and (max-width: 1023px)";
const ON_PHONE_HIDDEN = "[@media(pointer:coarse)_and_(max-width:1023px)]:hidden";
const ON_PHONE_SHOWN = "hidden [@media(pointer:coarse)_and_(max-width:1023px)]:flex";

/**
 * "Start Practice N" (CAP-2): posts the item and the browser's time zone (for
 * a profile that does not exist yet) to the Start action, which moves on to
 * the exam screen. Disabled while pending; every failure lands in the one
 * inline slot under the button. With `lock`, the Primary Button is
 * `aria-disabled` (DESIGN.md › Primary Button: muted fill, no edge, no glow),
 * stays focusable so its reason (a caption under it, in `aria-describedby`) is
 * read, and never submits; with `lock.attemptId` the caption adds "Go to the
 * attempt", as the `blocked` slot does. `fullWidth` fills its container at every width
 * (Level Detail Panel foot). `text` replaces "Start {label}" ("Start Test",
 * "Try the Test again", "Practice again"); `variant="secondary"` is the
 * quieter row button; `reasonId` points at a lock caption rendered elsewhere
 * (the panel shows it once) instead of this control's own. On a phone
 * (`PHONE_QUERY`) the form is hidden by CSS and a look-alike button shows
 * the phone message inline (polite) and calls nothing; with `lock` it is
 * `aria-disabled` and described by the lock reason instead.
 */
export function StartControl({
  itemId,
  label,
  lock,
  fullWidth = false,
  text,
  variant = "primary",
  reasonId,
}: {
  itemId: string;
  label?: string;
  lock?: StartLock;
  fullWidth?: boolean;
  text?: string;
  variant?: "primary" | "secondary";
  reasonId?: string;
}) {
  const [state, formAction, pending] = useActionState(startAttempt, INITIAL);
  const [phoneTapped, setPhoneTapped] = useState(false);
  const timeZoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      if (timeZoneRef.current) timeZoneRef.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    } catch {
      // No zone: the action asks for a reload instead of storing a guess.
    }
  }, []);

  const messageId = `start-${itemId}-message`;
  const lockId = reasonId ?? `start-${itemId}-lock`;
  const phoneId = `start-${itemId}-phone`;
  const Icon = variant === "secondary" ? RotateCcw : Play;
  const caption = text ?? `Start ${label}`;
  const width = cn("w-full", !fullWidth && "sm:w-auto sm:self-start");
  const look = cn(
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md font-bold",
    variant === "primary" ? "h-11 px-[18px]" : "h-9 px-3 text-sm",
  );

  return (
    <div className="flex flex-col gap-2">
      <form
        action={lock ? undefined : formAction}
        onSubmit={lock ? (event) => event.preventDefault() : undefined}
        className={cn("flex flex-col gap-2", ON_PHONE_HIDDEN)}
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
            look,
            width,
            "mb-1 transition-[transform,box-shadow,opacity] disabled:cursor-not-allowed",
            lock
              ? "mb-0 cursor-not-allowed bg-muted text-muted-foreground"
              : variant === "primary"
                ? "bg-primary text-primary-foreground shadow-[0_4px_0_0_var(--primary-edge)] hover:shadow-[0_4px_0_0_var(--primary-edge),0_0_0_4px_var(--glow-soft)] active:translate-y-[2px] active:shadow-[0_2px_0_0_var(--primary-edge)] disabled:translate-y-0 disabled:opacity-60"
                : "border border-border bg-card text-foreground hover:bg-muted disabled:opacity-60",
          )}
        >
          <Icon aria-hidden="true" className={cn("size-4", variant === "primary" && "fill-current stroke-none")} />
          {pending ? "Starting…" : caption}
        </button>
      </form>
      <div data-slot="phone-start" className={cn("flex-col gap-2", ON_PHONE_SHOWN)}>
        <button
          type="button"
          onClick={lock ? undefined : () => setPhoneTapped(true)}
          aria-disabled={lock ? true : undefined}
          aria-describedby={lock ? lockId : phoneId}
          className={cn(
            look,
            width,
            "min-h-11",
            lock ? "cursor-not-allowed bg-muted text-muted-foreground" : "border border-border bg-card text-foreground",
          )}
        >
          <Icon aria-hidden="true" className={cn("size-4", variant === "primary" && "fill-current stroke-none")} />
          {caption}
        </button>
        <div id={phoneId} role="status" aria-live="polite" lang="id" className="text-xs leading-[1.4] font-medium empty:hidden">
          {phoneTapped ? phoneStartMessage : null}
        </div>
      </div>
      {lock && !reasonId && (
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
        {state.status === "refused" && (
          <span lang="id" className="text-destructive">
            {state.reason === "test_locked"
              ? testLockLine(state.toGo ?? PRACTICE_COUNT)
              : startRefusedMessages[state.reason]}
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
    </div>
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
