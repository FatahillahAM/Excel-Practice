"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type MouseEvent, type Ref } from "react";
import type { QuestionResult } from "@/core/grading/result";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { resultsMessages } from "@/messages/id";
import { TipsCard } from "./tips-card";

/** Quiet time after the last `scroll` event before the shown card is read from the scroll position. */
export const SCROLL_SETTLE_MS = 120;

const tipAnchor = (questionNumber: number) => `tip-${questionNumber}`;

const NAV_BUTTON =
  "grid size-11 place-items-center rounded-[10px] border border-input-border bg-card text-foreground sm:size-8 " +
  "aria-disabled:cursor-default aria-disabled:text-muted-foreground aria-disabled:opacity-60";

/** A question that carries a Tip (`tip` may be missing altogether in data older than the schema). */
type TippedQuestion = QuestionResult & { tip: NonNullable<QuestionResult["tip"]> };
const hasTip = (question: QuestionResult): question is TippedQuestion => question.tip != null;

interface CarouselHandle {
  /** Shows and focuses the card of that question; `false` when it has none. */
  showQuestion: (questionNumber: number) => boolean;
}

/**
 * Below the Outcome panel (EXPERIENCE.md › Results): the Wrong Answer Rows (or
 * "Semua benar!"), then the Tips Carousel with one Tips Card per question
 * that has a Tip. Rendered from the stored `Result`'s questions only.
 */
export function ResultsDetails({
  questions,
  levelNumber,
  scene = false,
}: {
  questions: readonly QuestionResult[];
  levelNumber: number | null;
  /** May the sections lift in while scrolled (from `resultsMotion`)? Also off on Save-Data / low memory. */
  scene?: boolean;
}) {
  const motionScene = useMotionPreference({ scene: true });
  const lift = scene && motionScene === "full" ? "lift" : undefined;
  const wrong = questions.filter((question) => !question.correct);
  const tipped = questions.filter(hasTip);
  const carousel = useRef<CarouselHandle>(null);

  function seeTip(event: MouseEvent<HTMLAnchorElement>, questionNumber: number) {
    // A modified or non-primary click (new tab, download…) is the browser's.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (carousel.current?.showQuestion(questionNumber)) event.preventDefault();
  }

  return (
    <>
      {wrong.length === 0 ? (
        <section data-slot="all-correct" data-scene={lift} aria-label="Answers">
          <p lang="id" className="rounded-md bg-success-soft px-3.5 py-3 text-[15px] font-bold text-success">
            {resultsMessages.allCorrect}
          </p>
        </section>
      ) : (
        <section data-slot="wrong-answers" data-scene={lift} aria-labelledby="results-wrong-heading" className="flex flex-col gap-2.5">
          <h2 id="results-wrong-heading" className="flex items-center gap-2.5 text-[16px] font-extrabold">
            Wrong answers <span className="font-mono text-[12px] font-bold text-muted-foreground">{wrong.length}</span>
          </h2>
          <ul className="grid gap-2.5">
            {wrong.map((question) => (
              <li
                key={question.number}
                data-slot="wrong-answer-row"
                className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-md bg-destructive-soft px-3.5 py-3 sm:grid-cols-[auto_1fr_auto]"
              >
                <span className="text-[14px] font-extrabold whitespace-nowrap text-destructive">
                  <span aria-hidden="true">✗</span> <span lang="id">{resultsMessages.question(question.number)}</span>
                </span>
                <p lang="id" className="text-foreground [overflow-wrap:anywhere]">
                  {question.reasonText}
                </p>
                {hasTip(question) ? (
                  <a
                    href={`#${tipAnchor(question.number)}`}
                    onClick={(event) => seeTip(event, question.number)}
                    aria-label={`See tip, ${resultsMessages.question(question.number)}`}
                    className="col-start-2 inline-flex min-h-6 min-w-6 items-center justify-self-start text-[13px] font-bold whitespace-nowrap text-primary underline-offset-4 hover:underline sm:col-start-3"
                  >
                    See tip
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tipped.length > 0 ? (
        // Keyed on its cards: another list of Tips starts again at the first card.
        <TipsCarousel key={tipped.map((question) => question.number).join(",")} ref={carousel} tipped={tipped} levelNumber={levelNumber} lift={lift} />
      ) : null}
    </>
  );
}

/**
 * Tips Carousel: moves exactly one card per Prev/Next press or Left/Right
 * arrow (on its region or on a card), never by itself; at an end the button is
 * `aria-disabled` and keeps focus. The current card is marked (`data-current`,
 * `aria-current`, a `primary` border), so the position shows even when the
 * track cannot scroll. "Tip k of n" is a polite live region. Smooth scrolling
 * is CSS (`scroll-smooth`), so the global reduced-motion rule turns it off.
 */
function TipsCarousel({
  tipped,
  levelNumber,
  lift,
  ref,
}: {
  tipped: readonly TippedQuestion[];
  levelNumber: number | null;
  lift: "lift" | undefined;
  ref: Ref<CarouselHandle>;
}) {
  const count = tipped.length;
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  /** Where the track sits when card `i` is shown: its left edge, capped at the end of the track (the last cards share it). */
  function targetLeft(i: number): number {
    const track = trackRef.current;
    const slide = slideRefs.current[i];
    if (!track || !slide) return 0;
    const max = Math.max(0, track.scrollWidth - track.clientWidth);
    return Math.min(Math.max(0, slide.offsetLeft - (slideRefs.current[0]?.offsetLeft ?? 0)), max);
  }

  function select(next: number) {
    indexRef.current = next;
    setIndex(next);
  }

  function show(next: number) {
    const clamped = Math.min(Math.max(next, 0), count - 1);
    select(clamped);
    trackRef.current?.scrollTo({ left: targetLeft(clamped) });
  }

  /** One card back or forward; `false` at an end. */
  function step(delta: -1 | 1): boolean {
    const next = indexRef.current + delta;
    if (next < 0 || next > count - 1) return false;
    show(next);
    return true;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const onTrack = event.target === event.currentTarget;
    const onSlide = slideRefs.current.includes(event.target as HTMLDivElement);
    if (!onTrack && !onSlide) return;
    event.preventDefault();
    const moved = step(event.key === "ArrowRight" ? 1 : -1);
    // Focus was on a card ("See tip"): it follows to the card now shown.
    if (moved && onSlide) slideRefs.current[indexRef.current]?.focus({ preventScroll: true });
  }

  useImperativeHandle(ref, () => ({
    showQuestion(questionNumber) {
      const target = tipped.findIndex((question) => question.number === questionNumber);
      const track = trackRef.current;
      if (target < 0 || !track) return false;
      track.scrollIntoView({ block: "nearest" });
      show(target);
      slideRefs.current[target]?.focus({ preventScroll: true });
      return true;
    },
  }));

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The track was scrolled by the user (swipe, wheel) or by the browser (a `#tip-N` anchor before hydration).
    const sync = () => {
      const left = track.scrollLeft;
      // The current card sits here (after a button press, or as one of the cards sharing the end): keep it.
      if (Math.abs(left - targetLeft(indexRef.current)) <= 2) return;
      // Otherwise the card whose position is nearest; of the cards sharing the end, the first (its left edge is nearest).
      let nearest = 0;
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < count; i += 1) {
        const distance = Math.abs(left - targetLeft(i));
        if (distance < best) {
          best = distance;
          nearest = i;
        }
      }
      select(nearest);
    };
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(sync, SCROLL_SETTLE_MS);
    };
    const onScrollEnd = () => {
      clearTimeout(timer);
      sync();
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    track.addEventListener("scrollend", onScrollEnd);
    sync();
    // A resized track has other positions: put the current card back at its own.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => track.scrollTo({ left: targetLeft(indexRef.current) }));
    observer?.observe(track);
    return () => {
      clearTimeout(timer);
      observer?.disconnect();
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("scrollend", onScrollEnd);
    };
    // `targetLeft` and `select` use refs and a state setter only.
  }, [count]);

  const atStart = index <= 0;
  const atEnd = index >= count - 1;

  return (
    <section data-slot="tips" data-scene={lift} aria-labelledby="results-tips-heading" className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <h2 id="results-tips-heading" className="text-[16px] font-extrabold">
          Tips &amp; Tricks
        </h2>
        <div className="flex items-center gap-2">
          <p aria-live="polite" className="mr-1 text-[12px] font-medium text-muted-foreground">
            {`Tip ${index + 1} of ${count}`}
          </p>
          <button type="button" aria-label="Previous tip" aria-disabled={atStart} onClick={() => step(-1)} className={NAV_BUTTON}>
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <button type="button" aria-label="Next tip" aria-disabled={atEnd} onClick={() => step(1)} className={NAV_BUTTON}>
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
      <div className="relative after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-12 after:bg-linear-to-r after:from-transparent after:to-background after:content-['']">
        <div
          ref={trackRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="Tips"
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="relative flex snap-x snap-mandatory gap-3.5 overflow-x-auto scroll-smooth rounded-lg py-0.5 pr-12 pl-0.5 [scrollbar-width:none] focus-visible:outline-offset-0"
        >
          {tipped.map((question, i) => (
            <div
              key={question.number}
              ref={(node) => {
                slideRefs.current[i] = node;
              }}
              role="group"
              aria-roledescription="slide"
              aria-label={`Tip ${i + 1} of ${count}`}
              aria-current={i === index ? "true" : undefined}
              data-current={i === index ? "true" : undefined}
              // Focusable by "See tip" only, never a tab stop.
              tabIndex={-1}
              className="w-[272px] max-w-[82vw] flex-none snap-start scroll-ml-0.5 rounded-lg focus-visible:-outline-offset-2"
            >
              <TipsCard
                id={tipAnchor(question.number)}
                tip={question.tip}
                questionNumber={question.number}
                correct={question.correct}
                levelNumber={levelNumber}
                className={i === index ? "border-primary" : undefined}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
