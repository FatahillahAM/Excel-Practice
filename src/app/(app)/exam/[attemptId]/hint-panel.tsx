"use client";

import { Lightbulb } from "lucide-react";
import { unstable_rethrow } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState, type FormEvent, type ReactNode, type Ref } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// The hints module alone (not the barrel): keeps the lifecycle schemas out of the client bundle.
import { hintsLeft, nextHintIndex, questionExhausted, type HintReveal, type HintState } from "@/core/services/attempts/hints";
import { hintMessages } from "@/messages/id";
import { revealHint, type HintActionState } from "./hint-actions";

const IDLE: HintActionState = { status: "idle" };

/** Hint Button (DESIGN.md › Hint Button): warning on warning-soft, 40px. */
const HINT_BUTTON = "inline-flex min-h-10 max-w-full items-center gap-2 rounded-md px-3.5 text-left text-sm font-bold transition-opacity";
const HINT_ON = "cursor-pointer bg-warning-soft text-warning";
const HINT_OFF = "cursor-not-allowed bg-muted text-muted-foreground";

const revealKey = (reveal: { question: number; index: number }) => `${reveal.question}:${reveal.index}`;

/** "2 hints left" / "1 hint left". */
export function hintsLeftText(left: number): string {
  return `${left} ${left === 1 ? "hint" : "hints"} left`;
}

/**
 * The polite status line (English chrome, EXPERIENCE.md › live regions): one
 * combined message after a reveal, and the outcome of a press that revealed
 * nothing.
 */
export const hintNotices = {
  revealed: (left: number) => `Hint revealed, ${hintsLeftText(left)}.`,
  quotaUsed: "No hints left.",
  noMoreHints: (question: number) => `All hints for Soal ${question} shown.`,
  refreshed: "Hints were out of date; refreshed.",
} as const;

/** Adds `reveal` to `state` unless it is listed already, with the server's `used` and `quota`. */
export function withReveal(state: HintState, reveal: HintReveal, used: number, quota: number): HintState {
  const known = state.revealed.some((r) => revealKey(r) === revealKey(reveal));
  return { ...state, quota, used: Math.max(used, state.used), revealed: known ? state.revealed : [...state.revealed, reveal] };
}

/**
 * The revealed hints in reveal order: a block each with a 3px warning left
 * border, "Hint k · Soal N" and "−5", the text in Indonesian. `blockRef`
 * (the live panel) lets focus move to a new block (`tabindex="-1"`); the
 * read-only list after `open` (`ExamStatus`) passes none.
 */
export function RevealedHintList({
  revealed,
  blockRef,
}: {
  revealed: readonly HintReveal[];
  blockRef?: (key: string) => Ref<HTMLDivElement>;
}) {
  if (revealed.length === 0) return null;
  return (
    <ul aria-label="Revealed hints" className="mt-3.5 flex w-full flex-col gap-2.5">
      {revealed.map((reveal) => {
        const key = revealKey(reveal);
        return (
          <li key={key}>
            <div
              ref={blockRef?.(key)}
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
  );
}

/**
 * Hint Select + Hint Button beside the Upload Dropzone (`beside`), and the
 * revealed hints below them (EXPERIENCE.md › Hint Select, Hint Button; DESIGN.md
 * › Layout: side by side ≥8px apart, stacked on phone; `key-exam.html`).
 * Rendered by `ExamStatus` only while the attempt is `open` and its quota > 0.
 *
 * The hint state is `ExamStatus`'s (`state`, changed through `onChange`), so
 * a reveal that resolves after the attempt left `open` still lands in the
 * read-only list there; it starts from the server's state on every render of
 * the exam page (reload, Resume, refresh), never from browser storage.
 *
 * The button posts the selected soal and its next hint index to
 * `revealHint`. While pending it is `aria-disabled` and a second submit is
 * ignored (no `disabled`, so focus is not dropped to `<body>`), then focus
 * moves to the new hint (`tabindex="-1"`) and the status line says "Hint
 * revealed, K hints left." Quota 0: "No hints left", `aria-disabled`, focus
 * kept; a soal whose hints are all shown: `aria-disabled`, "All hints for Soal
 * N shown". `quota_used`, `no_more_hints` and `out_of_order` say so in the
 * status line, focus on the button; `out_of_order` (the posted index is past
 * the server's next one: this screen's state is out of step with the
 * database) also asks for the server state again (`onResync`). `not_open` /
 * `error`: the message in a `role="alert"` line, focus on the button;
 * `not_open` also asks `ExamStatus` to poll the status now (`onNotOpen`).
 */
export function HintPanel({
  attemptId,
  state,
  onChange,
  onResync,
  onNotOpen,
  beside,
}: {
  attemptId: string;
  state: HintState;
  onChange: (update: (current: HintState) => HintState) => void;
  onResync: () => void;
  onNotOpen: () => void;
  beside: ReactNode;
}) {
  const labelId = useId();
  const triggerId = useId();
  const [selected, setSelected] = useState<number>(state.questions[0]?.number ?? 1);
  const [message, setMessage] = useState<keyof typeof hintMessages | null>(null);
  const [notice, setNotice] = useState("");
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
        const reveal = next.reveal;
        onChange((current) => withReveal(current, reveal, next.used, next.quota));
        if (next.status === "revealed") setNotice(hintNotices.revealed(Math.max(0, next.quota - next.used)));
        focus(revealKey(reveal));
        return;
      }
      case "quota_used":
        onChange((current) => ({ ...current, quota: next.quota, used: Math.max(next.used, next.quota, current.used) }));
        setNotice(hintNotices.quotaUsed);
        focus("button");
        return;
      case "no_more_hints":
        onChange((current) => ({
          ...current,
          used: Math.max(next.used, current.used),
          questions: current.questions.map((q) =>
            q.number === question ? { ...q, hintCount: Math.min(q.hintCount, nextHintIndex(current, question)) } : q,
          ),
        }));
        setNotice(hintNotices.noMoreHints(question));
        focus("button");
        return;
      case "out_of_order":
        setNotice(hintNotices.refreshed);
        focus("button");
        onResync();
        return;
      case "not_open":
        setMessage("notOpen");
        focus("button");
        onNotOpen();
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

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    // `aria-disabled` and pending: the press does nothing and focus stays on the button.
    if (off || pending || inFlight.current) {
      event.preventDefault();
      return;
    }
    inFlight.current = true;
    setMessage(null);
    setNotice("");
  }

  const name =
    left === 0
      ? "No hints left"
      : exhausted
        ? `All hints for Soal ${selected} shown`
        : `Hint for Soal ${selected}, minus 5 points, ${left} left`;

  const blockRef = (key: string) => (element: HTMLDivElement | null) => {
    if (element) blocks.current.set(key, element);
    else blocks.current.delete(key);
  };

  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:flex-none">
          <span id={labelId} className="text-[13px] font-semibold text-muted-foreground">
            Hint for
          </span>
          <Select value={String(selected)} onValueChange={(value) => setSelected(Number(value))}>
            {/* Named by the visible label and its own value: "Hint for Soal 2". */}
            <SelectTrigger id={triggerId} aria-labelledby={`${labelId} ${triggerId}`}>
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
          <form action={formAction} onSubmit={onSubmit} className="max-w-full">
            <input type="hidden" name="attemptId" value={attemptId} />
            <input type="hidden" name="question" value={selected} />
            <input type="hidden" name="hintIndex" value={nextHintIndex(state, selected)} />
            <button
              ref={button}
              type="submit"
              aria-label={name}
              aria-disabled={off || pending ? "true" : undefined}
              aria-busy={pending ? "true" : undefined}
              className={`${HINT_BUTTON} ${off ? HINT_OFF : HINT_ON} ${pending ? "cursor-progress opacity-70" : ""}`}
            >
              {left === 0 ? (
                <>
                  <Lightbulb aria-hidden="true" className="size-4 shrink-0" />
                  No hints left
                </>
              ) : exhausted ? (
                <>
                  <Lightbulb aria-hidden="true" className="size-4 shrink-0" />
                  <span>
                    All hints for <span lang="id">{`Soal ${selected}`}</span> shown
                  </span>
                </>
              ) : (
                <>
                  {pending ? (
                    <span
                      aria-hidden="true"
                      className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
                    />
                  ) : (
                    <Lightbulb aria-hidden="true" className="size-4 shrink-0" />
                  )}
                  <span className="whitespace-nowrap">Hint (−5)</span>
                  <small className="border-l border-warning/40 pl-2 font-mono text-xs font-bold whitespace-nowrap opacity-90">{`${left} left`}</small>
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
      <p role="status" className="text-[13px] text-muted-foreground [&:not(:empty)]:mt-2">
        {notice}
      </p>
      <RevealedHintList revealed={state.revealed} blockRef={blockRef} />
    </div>
  );
}
