import { Flame, Snowflake } from "lucide-react";
import { FREEZES_PER_WEEK, type DayStatus } from "@/core/progress";
import { cn } from "@/lib/utils";
import { shellMessages } from "@/messages/id";
import { loadStreak, type StreakView } from "../progress";
import { RiskCountdown, UseFreezeButton } from "./freeze-controls";

const CARD = "flex w-full flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:p-[22px]";
const LABEL = "font-mono text-[10.5px] leading-[1.2] font-bold tracking-[0.1em] uppercase";
const PILL = "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs leading-[1.4] font-bold";

export type StreakHeroState = "safe" | "at_risk" | "frozen" | "zero";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const DAY_STATUS: Record<DayStatus, string> = {
  done: "practised",
  frozen: "frozen",
  missed: "missed",
  pending: "not yet",
  future: "upcoming",
};

const DAY_DOT: Record<DayStatus, string> = {
  done: "bg-primary text-primary-foreground",
  frozen: "bg-muted text-foreground shadow-[inset_0_0_0_1.5px_var(--primary)]",
  missed: "bg-card text-muted-foreground shadow-[inset_0_0_0_1.5px_var(--border)]",
  pending: "bg-card text-foreground shadow-[inset_0_0_0_1.5px_var(--primary)]",
  future: "bg-card text-muted-foreground",
};

export function streakHeroState(view: StreakView): StreakHeroState {
  if (view.todaySafe) return "safe";
  if (view.frozenToday) return "frozen";
  return view.count > 0 ? "at_risk" : "zero";
}

/**
 * Streak Hero (DESIGN.md › Dashboard; EXPERIENCE.md): the streak numeral, the
 * Freeze Pill (or Use freeze when today is not safe), the Streak Risk Pill
 * with the time left until 00:00 local, and the Week Strip (Monday →
 * Sunday). Safe / at risk (numeral desaturated) / frozen today / zero (Use
 * freeze stays, de-emphasised). The final numeral is in the server HTML; no
 * count-up.
 */
export function StreakHeroView({ view }: { view: StreakView }) {
  const state = streakHeroState(view);
  const atRisk = state === "at_risk";
  const freezeText = `${view.freezesLeft} of ${FREEZES_PER_WEEK} freezes left`;
  return (
    <section aria-labelledby="streak-hero-title" data-state={state} className={CARD}>
      <h2 id="streak-hero-title" className={cn(LABEL, "text-muted-foreground")}>
        Streak
      </h2>
      <p className="flex items-baseline gap-2">
        <span
          data-slot="streak-numeral"
          className={cn("text-[clamp(96px,48vw,190px)] leading-none font-bold tabular-nums lg:text-[clamp(120px,12vw,232px)]", state === "zero" ? "text-muted-foreground" : "text-primary", atRisk && "opacity-[.85] saturate-[.35]")}
        >
          {view.count}
        </span>
        <span className="font-bold">day streak</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {state === "safe" && (
          <span data-slot="safe-pill" className={cn(PILL, "bg-muted text-foreground")}>
            <Flame aria-hidden="true" className="size-3.5 text-primary" />
            Safe today
          </span>
        )}
        {state === "frozen" && (
          <span data-slot="frozen-pill" className={cn(PILL, "bg-muted text-foreground")}>
            <Snowflake aria-hidden="true" className="size-3.5" />
            Frozen today
          </span>
        )}
        {atRisk && (
          <span data-slot="risk-pill" className={cn(PILL, "bg-destructive/10 text-destructive")}>
            <RiskCountdown msLeft={view.msLeft} />
          </span>
        )}
        <span data-slot="freeze-pill" className={cn(PILL, "border border-border text-muted-foreground")}>
          <Snowflake aria-hidden="true" className="size-3.5" />
          {freezeText}
        </span>
      </div>
      {(atRisk || state === "zero") && <UseFreezeButton left={view.freezesLeft} today={view.today} quiet={state === "zero"} />}
      <ol aria-label="This week" className="grid grid-cols-7 gap-1">
        {view.week.map((day, index) => (
          <li key={day.date} data-status={day.status} className="flex flex-col items-center gap-1">
            <span
              aria-hidden="true"
              className={cn("flex size-7 items-center justify-center rounded-full text-[11px] font-bold", DAY_DOT[day.status])}
            >
              {day.status === "pending" ? "?" : DAY_NAMES[index].slice(0, 1)}
            </span>
            <span className="sr-only">
              {day.status === "pending" ? "Today" : DAY_NAMES[index]}: {DAY_STATUS[day.status]}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Server part: the streak per request; a failed read (or no time zone) replaces the hero with the first-load message. */
export async function StreakHero() {
  const view = await loadStreak();
  if (view === null) return null;
  if (view === "failed") {
    return (
      <div className={CARD}>
        <p role="alert" lang="id">
          {shellMessages.firstLoadFailed}
        </p>
        <a href="/dashboard" className="font-bold text-primary underline-offset-4 hover:underline">
          Try again
        </a>
      </div>
    );
  }
  return <StreakHeroView view={view} />;
}

/** Shaped like the hero: label, numeral, pills, week strip. */
export function StreakHeroSkeleton() {
  return (
    <div aria-hidden="true" data-slot="streak-hero-skeleton" className={CARD}>
      <div className="h-3 w-16 rounded bg-muted" />
      <div className="h-12 w-24 rounded-md bg-muted" />
      <div className="h-6 w-40 rounded-full bg-muted" />
      <div className="h-7 rounded-md bg-muted" />
    </div>
  );
}
