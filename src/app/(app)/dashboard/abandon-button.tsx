"use client";

import { unstable_rethrow } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  alertDialogButton,
} from "../../../components/ui/alert-dialog";
import { attemptMessages } from "../../../messages/id";
import { abandonAttempt, type AbandonState } from "./abandon-actions";

const INITIAL: AbandonState = { status: "idle" };

/**
 * Attempt Card's outline "Abandon": opens a confirm dialog (role
 * `alertdialog`: focus trapped, `Esc` or Cancel closes with no change, focus
 * back to "Abandon"). The destructive "Abandon" posts the attempt to
 * `abandonAttempt` and stays in the dialog while pending ("Abandoning…",
 * disabled; Cancel too, so the result is not lost). A failure lands in the
 * dialog's alert slot. On `done` the re-rendered Dashboard has no card: the
 * dialog closes and focus moves to the page `<h1>`, also when the card
 * (and this button) unmounts in the same update.
 */
export function AbandonButton({
  attemptId,
  attemptTitle,
  focusAfterId,
}: {
  attemptId: string;
  attemptTitle: string;
  /** The page `<h1>` (`tabIndex={-1}`) that takes focus once the attempt is abandoned. */
  focusAfterId: string;
}) {
  const [open, setOpen] = useState(false);
  /** An error from an earlier try stays hidden after the dialog is opened again, until the next try. */
  const [stale, setStale] = useState(false);
  const done = useRef(false);
  const focusTitle = () => document.getElementById(focusAfterId)?.focus();

  const [state, formAction, pending] = useActionState(async (previous: AbandonState, formData: FormData): Promise<AbandonState> => {
    setStale(false);
    let next: AbandonState;
    try {
      next = await abandonAttempt(previous, formData);
    } catch (error) {
      // Next's redirect (no session → Login) and interrupts go on; a transport failure is a message in the dialog.
      unstable_rethrow(error);
      return { status: "error" };
    }
    if (next.status === "done") {
      done.current = true;
      setOpen(false);
    }
    return next;
  }, INITIAL);

  // The card leaves with the revalidated page: hand focus to the title after radix restores its own.
  useEffect(
    () => () => {
      if (done.current) window.setTimeout(focusTitle, 0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup on unmount only; `focusTitle` reads the id at call time.
    [],
  );

  const errorId = `abandon-${attemptId}-error`;
  const showError = state.status === "error" && !pending && !stale;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (next) {
          // A fresh open: Cancel/Esc return focus to "Abandon" again.
          done.current = false;
          setStale(true);
        }
        setOpen(next);
      }}
    >
      <AlertDialogTrigger className={`${alertDialogButton.outline} flex-1`}>Abandon</AlertDialogTrigger>
      <AlertDialogContent
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
        onCloseAutoFocus={(event) => {
          if (!done.current) return;
          event.preventDefault();
          focusTitle();
        }}
      >
        <AlertDialogHeader>
          {/* radix wires the title to aria-labelledby and the description, which names the attempt, to aria-describedby. */}
          <AlertDialogTitle>Abandon this attempt?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block font-bold text-foreground">{attemptTitle}</span>{" "}
            <span lang="id">{attemptMessages.abandonBody}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div id={errorId} role="alert" lang="id" className="min-h-5 text-xs leading-[1.4] font-medium text-destructive">
          {showError && attemptMessages.abandonFailed}
        </div>
        <form action={formAction}>
          <input type="hidden" name="attemptId" value={attemptId} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={pending}>
              Cancel
            </AlertDialogCancel>
            <button
              type="submit"
              disabled={pending}
              aria-describedby={errorId}
              className={alertDialogButton.destructive}
            >
              {pending ? "Abandoning…" : "Abandon"}
            </button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
