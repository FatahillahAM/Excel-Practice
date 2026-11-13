import { Play } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AttemptCardView } from "../open-attempt";
import { AbandonButton } from "./abandon-button";

const LABEL = "font-mono text-[11px] leading-[1.2] font-bold tracking-[0.1em] uppercase";
const PRIMARY =
  "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-[18px] font-bold text-primary-foreground shadow-[0_4px_0_0_var(--primary-edge)] transition-[transform,box-shadow] hover:shadow-[0_4px_0_0_var(--primary-edge),0_0_0_4px_var(--glow-soft)] active:translate-y-[2px] active:shadow-[0_2px_0_0_var(--primary-edge)]";

/** The Dashboard's `<h1>` (`tabIndex={-1}`): focus lands there once the card is gone. */
export const DASHBOARD_TITLE_ID = "dashboard-title";

/**
 * Attempt Card (DESIGN.md › Attempt Card, `key-dashboard.html`): `card` on a
 * `glow` border, `rounded.lg`; "Attempt in progress" key in `label`, the
 * attempt's name, the time since Start from the server at render (AD-8; the
 * live clock is on the exam screen) or the exam screen's status line once received, then
 * Primary "Resume" (a link to the exam screen) and outline "Abandon" (a
 * confirm dialog). Rendered on the server from the request's read.
 */
export function AttemptCard({ attemptId, view }: { attemptId: string; view: AttemptCardView }) {
  const headingId = `attempt-${attemptId}-heading`;
  return (
    <section
      aria-labelledby={headingId}
      className="flex w-full flex-col rounded-lg border border-glow bg-card p-4 shadow-[0_0_0_3px_var(--glow-soft)]"
    >
      <p className={cn(LABEL, "flex items-center gap-1.5 text-primary")}>
        <span aria-hidden="true" className="size-2 rounded-full bg-primary shadow-[0_0_0_3px_var(--glow-soft)]" />
        Attempt in progress
      </p>
      <h2 id={headingId} className="mt-1.5 text-base font-extrabold">
        {view.title}
      </h2>
      <p className="mt-0.5 mb-3 flex items-baseline gap-2">
        {view.time !== null && (
          <span className="font-mono text-[26px] font-extrabold tracking-[-0.04em] tabular-nums">{view.time}</span>
        )}
        <span
          className={
            view.time !== null
              ? "text-xs leading-[1.4] font-medium text-muted-foreground"
              : "font-semibold text-muted-foreground"
          }
        >
          {view.caption}
        </span>
      </p>
      <div className="flex gap-2">
        <Link href={view.resumeHref} className={PRIMARY}>
          <Play aria-hidden="true" className="size-4 fill-current stroke-none" />
          Resume
        </Link>
        <AbandonButton attemptId={attemptId} attemptTitle={view.title} focusAfterId={DASHBOARD_TITLE_ID} />
      </div>
    </section>
  );
}
