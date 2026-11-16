"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import type { QuestionResult } from "@/core/grading/result";
import { resultsMessages } from "@/messages/id";
import { TipsCard } from "./tips-card";

/** Quiet time after the last `scroll` event before the shown card is read from the scroll position. */
const SCROLL_SETTLE_MS = 120;

const tipAnchor = (questionNumber: number) => `tip-${questionNumber}`;

const NAV_BUTTON =
  "grid size-11 place-items-center rounded-[10px] border border-input-border bg-card text-foreground sm:size-8 " +
  "aria-disabled:cursor-default aria-disabled:text-muted-foreground aria-disabled:opacity-60";

/**
 * Below the Outcome panel (EXPERIENCE.md › Results): the Wrong Answer Rows (or
 * "Semua benar!"), then the Tips Carousel with one Tips Card per question
 * that has a Tip. Rendered from the stored `Result`'s questions only.
 *
 * The carousel moves exactly one card per Prev/Next press or Left/Right arrow
 * on its region, never by itself; at an end the button is `aria-disabled` and
 * keeps focus. "Tip k of n" is a polite live region. Smooth scrolling is CSS
 * (`scroll-smooth`), so the global reduced-motion rule turns it off.
 */
export function ResultsDetails({ questions, levelNumber }: { questions: readonly QuestionResult[]; levelNumber: number | null }) {
  const wrong = questions.filter((question) => !question.correct);
  const tipped = questions.filter((question) => question.tip !== null);
  const count = tipped.length;

  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  /** Where the track sits when card `i` is shown: its left edge, capped at the end of the track. */
  function targetLeft(i: number): number {
    const track = trackRef.current;
    const slide = slideRefs.current[i];
    if (!track || !slide) return 0;
    const max = Math.max(0, track.scrollWidth - track.clientWidth);
    return Math.min(Math.max(0, slide.offsetLeft - (slideRefs.current[0]?.offsetLeft ?? 0)), max);
  }

  function show(next: number) {
    const clamped = Math.min(Math.max(next, 0), count - 1);
    indexRef.current = clamped;
    setIndex(clamped);
    trackRef.current?.scrollTo({ left: targetLeft(clamped) });
  }

  function step(delta: -1 | 1) {
    const next = indexRef.current + delta;
    if (next < 0 || next > count - 1) return;
    show(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    step(event.key === "ArrowRight" ? 1 : -1);
  }

  function seeTip(event: MouseEvent<HTMLAnchorElement>, questionNumber: number) {
    const target = tipped.findIndex((question) => question.number === questionNumber);
    const track = trackRef.current;
    if (target < 0 || !track) return;
    event.preventDefault();
    track.scrollIntoView({ block: "nearest" });
    show(target);
    track.focus({ preventScroll: true });
  }

  // The user scrolled the track (swipe, wheel, scrollbar): the shown card is the one nearest its left edge.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || count === 0) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      const left = track.scrollLeft;
      // A programmatic move that has arrived: keep its card (the last cards share the end position).
      if (Math.abs(left - targetLeft(indexRef.current)) <= 2) return;
      let nearest = 0;
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < count; i += 1) {
        const distance = Math.abs(left - targetLeft(i));
        if (distance < best) {
          best = distance;
          nearest = i;
        }
      }
      if (left >= track.scrollWidth - track.clientWidth - 2) nearest = count - 1;
      indexRef.current = nearest;
      setIndex(nearest);
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
    return () => {
      clearTimeout(timer);
      track.removeEventListener("scroll", onScroll);
      track.removeEventListener("scrollend", onScrollEnd);
    };
    // `targetLeft` reads refs only.
  }, [count]);

  const atStart = index <= 0;
  const atEnd = index >= count - 1;

  return (
    <>
      {wrong.length === 0 ? (
        <p lang="id" className="rounded-md bg-success-soft px-3.5 py-3 text-[15px] font-bold text-success">
          {resultsMessages.allCorrect}
        </p>
      ) : (
        <section aria-labelledby="results-wrong-heading" className="flex flex-col gap-2.5">
          <h2 id="results-wrong-heading" className="flex items-center gap-2.5 text-[16px] font-extrabold">
            Wrong answers
            <span className="font-mono text-[12px] font-bold text-muted-foreground">{wrong.length}</span>
          </h2>
          <ul className="grid gap-2.5">
            {wrong.map((question) => (
              <li
                key={question.number}
                data-slot="wrong-answer-row"
                className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-md bg-destructive-soft px-3.5 py-3 sm:grid-cols-[auto_1fr_auto]"
              >
                <span className="text-[14px] font-extrabold whitespace-nowrap text-destructive">
                  <span aria-hidden="true">✗</span> <span lang="id">{`Soal ${question.number}`}</span>
                </span>
                <p lang="id" className="text-foreground [overflow-wrap:anywhere]">
                  {question.reasonText}
                </p>
                {question.tip !== null ? (
                  <a
                    href={`#${tipAnchor(question.number)}`}
                    onClick={(event) => seeTip(event, question.number)}
                    aria-label={`See tip, Soal ${question.number}`}
                    className="col-start-2 justify-self-start text-[13px] font-bold whitespace-nowrap text-primary underline-offset-4 hover:underline sm:col-start-3"
                  >
                    See tip
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {count > 0 ? (
        <section aria-labelledby="results-tips-heading" className="flex flex-col gap-3">
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
                  data-current={i === index ? "true" : undefined}
                  className="w-[272px] max-w-[82vw] flex-none snap-start scroll-ml-0.5"
                >
                  <TipsCard
                    id={tipAnchor(question.number)}
                    tip={question.tip!}
                    questionNumber={question.number}
                    correct={question.correct}
                    levelNumber={levelNumber}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
