"use client";

import { Lightbulb } from "lucide-react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// The hints module alone (not the barrel): keeps the lifecycle schemas out of the client bundle.
import { hintsLeft, nextHintIndex, questionExhausted, type HintReveal, type HintState } from "@/core/services/attempts/hints";
import { hintMessages } from "@/messages/id";
import { revealHint, type HintActionState } from "./hint-actions";

const IDLE: HintActionState = { status: "idle" };

/** Hint Button (DESIGN.md › Hint Button): warning on warning-soft, 40px. */
const HINT_BUTTON =
  "inline-flex h-10 items-center gap-2 rounded-md px-3.5 text-sm font-bold whitespace-nowrap transition-opacity";
const HINT_ON = "cursor-pointer bg-warning-soft text-warning";
const HINT_OFF = "cursor-not-allowed bg-muted text-muted-foreground";

const revealKey = (reveal: { question: number; index: number }) => `${reveal.question}:${reveal.index}`;

/** "2 hints left" / "1 hint left": the polite announcement after a reveal. */
export function hintsLeftText(left: number): string {
  return `${left} ${left === 1 ? "hint" : "hints"} left`;
}

/**
 * Hint Select + Hint Button beside the Upload Dropzone (`beside`), and the
 * revealed hints below them (EXPERIENCE.md › Hint Select, Hint Button; DESIGN.md
 * › Layout: side by side ≥8px apart, stacked on phone; `key-exam.html`).
 * Rendered by `ExamStatus` only while the attempt is `open` and its quota > 0.
 *
 * `initial` is the server's state (rehydrated on every render of the exam
 * page: reload, Resume, `router.refresh()`); nothing is kept in browser
 * storage. The button posts the selected soal and its next hint index to
 * `revealHint`. While pending it is `aria-disabled` and a second submit is
 * ignored (no `disabled`, so focus is not dropped to `<body>`), then focus
 * moves to the new hint (`tabindex="-1"`). Quota 0: "No hints left",
 * `aria-disabled`, focus kept; a soal whose hints are all shown:
 * `aria-disabled`, "All hints for Soal N shown". `not_open` / `error`: the
 * message in a `role="alert"` line, focus back on the button.
 * `out_of_order` (another tab opened one): `router.refresh()` reloads the
 * state.
 */
export function HintPanel({ attemptId, initial, beside }: { attemptId: string; initial: HintState; beside: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<HintState>(initial);
  // A new server state (refresh) replaces the local one.
  const [shownInitial, setShownInitial] = useState(initial);
  if (initial !== shownInitial) {
    setShownInitial(initial);
    setState(initial);
  }
  const [selected, setSelected] = useState<number>(initial.questions[0]?.number ?? 1);
  const [message, setMessage] = useState<keyof typeof hintMessages | null>(null);
  const [announcement, setAnnouncement] = useState("");
  /** What to focus once the update is on screen: a revealed hint, or the button; `n` makes each request new. */
  const [focusRequest, setFocusRequest] = useState<{ target: string; n: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const blocks = useRef(new Map<string, HTMLDivElement>());
  /** The lock: set on submit, before any re-render, so a double `Enter` posts once. */
  const inFlight = useRef(false);

  function focus(target: string) {
    setFocusRequest((previous) => ({ target, n: (previous?.n ?? 0) + 1 }));
  }

  /** What one answer changes; `question` is the soal the form posted. */
  function apply(next: HintActionState, question: number) {
    switch (next.status) {
      case "revealed":
      case "already": {
        const reveal: HintReveal = next.reveal;
        setState((current) => {
          const known = current.revealed.some((r) => revealKey(r) === revealKey(reveal));
          return {
            ...current,
            quota: next.quota,
            used: next.used,
            revealed: known ? current.revealed : [...current.revealed, reveal],
          };
        });
        if (next.status === "revealed") setAnnouncement(hintsLeftText(Math.max(0, next.quota - next.used)));
        focus(revealKey(reveal));
        return;
      }
      case "quota_used":
        setState((current) => ({ ...current, quota: next.quota, used: Math.max(next.used, next.quota) }));
        return;
      case "no_more_hints": {
        setState((current) => ({
          ...current,
          used: next.used,
          questions: current.questions.map((q) =>
            q.number === question ? { ...q, hintCount: Math.min(q.hintCount, nextHintIndex(current, question)) } : q,
          ),
        }));
        return;
      }
      case "out_of_order":
        router.refresh();
        return;
      case "not_open":
        setMessage("notOpen");
        focus("button");
        return;
      case "error":
        setMessage("failed");
        focus("button");
        return;
      default:
        return;
    }
  }

  const [, formAction, pending] = useActionState(
    async (previous: HintActionState, formData: FormData): Promise<HintActionState> => {
      let next: HintActionState;
      try {
        next = await revealHint(previous, formData);
      } catch (error) {
        // Next's redirect (no session → Login) and interrupts go on; a transport failure is a message.
        unstable_rethrow(error);
        next = { status: "error" };
      } finally {
        inFlight.current = false;
      }
      apply(next, Number(formData.get("question")));
      return next;
    },
    IDLE,
  );

  useEffect(() => {
    if (focusRequest === null) return;
    const element = focusRequest.target === "button" ? button.current : blocks.current.get(focusRequest.target);
    element?.focus();
  }, [focusRequest]);

  const left = hintsLeft(state);
  const exhausted = questionExhausted(state, selected);
  const off = left === 0 || exhausted;
  const busy = pending;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // `aria-disabled` and pending: the press does nothing and focus stays on the button.
    if (off || pending || inFlight.current) {
      event.preventDefault();
      return;
    }
    inFlight.current = true;
    setMessage(null);
  }

  const name =
    left === 0
      ? "No hints left"
      : exhausted
        ? `All hints for Soal ${selected} shown`
        : `Hint for Soal ${selected}, minus 5 points, ${left} left`;

  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="flex flex-none gap-2">
          <Select value={String(selected)} onValueChange={(value) => setSelected(Number(value))}>
            <SelectTrigger aria-label="Hint for">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {state.questions.map((question) => (
                <SelectItem key={question.number} value={String(question.number)}>
                  <span lang="id">{`Soal ${question.number}`}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <form action={formAction} onSubmit={onSubmit}>
            <input type="hidden" name="attemptId" value={attemptId} />
            <input type="hidden" name="question" value={selected} />
            <input type="hidden" name="hintIndex" value={nextHintIndex(state, selected)} />
            <button
              ref={button}
              type="submit"
              aria-label={name}
              aria-disabled={off || busy ? "true" : undefined}
              aria-busy={busy ? "true" : undefined}
              className={`${HINT_BUTTON} ${off ? HINT_OFF : HINT_ON} ${busy ? "cursor-progress opacity-70" : ""}`}
            >
              {left === 0 ? (
                <>
                  <Lightbulb aria-hidden="true" className="size-4" />
                  No hints left
                </>
              ) : exhausted ? (
                <>
                  <Lightbulb aria-hidden="true" className="size-4" />
                  <span>
                    All hints for <span lang="id">{`Soal ${selected}`}</span> shown
                  </span>
                </>
              ) : (
                <>
                  {busy ? (
                    <span
                      aria-hidden="true"
                      className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
                    />
                  ) : (
                    <Lightbulb aria-hidden="true" className="size-4" />
                  )}
                  Hint (−5)
                  <small className="border-l border-warning/40 pl-2 font-mono text-xs font-bold opacity-90">{`${left} left`}</small>
                </>
              )}
            </button>
          </form>
        </div>
        <div className="min-w-0 flex-1">{beside}</div>
      </div>
      {message !== null && (
        <p role="alert" lang="id" className="mt-2 text-sm font-medium text-destructive">
          {hintMessages[message]}
        </p>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
      {state.revealed.length > 0 && (
        <ul aria-label="Revealed hints" className="mt-3.5 flex w-full flex-col gap-2.5">
          {state.revealed.map((reveal) => {
            const key = revealKey(reveal);
            return (
              <li key={key}>
                <div
                  ref={(element) => {
                    if (element) blocks.current.set(key, element);
                    else blocks.current.delete(key);
                  }}
                  tabIndex={-1}
                  data-hint={key}
                  className="w-full rounded-md border border-l-[3px] border-border border-l-warning bg-card px-3.5 py-3 text-left"
                >
                  <div className="flex items-center justify-between font-mono text-[11px] font-bold tracking-[0.1em] text-warning uppercase">
                    <span>
                      {`Hint ${reveal.index + 1} · `}
                      <span lang="id">{`Soal ${reveal.question}`}</span>
                    </span>
                    <span>−5</span>
                  </div>
                  <p lang="id" className="mt-1.5 text-foreground">
                    {reveal.text}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
