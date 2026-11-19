import { Check, Construction, Flag, Flame, Lock } from "lucide-react";
import { FINAL_EXAM_NAME, type LevelProgress, type LevelState } from "@/core/progress";
import { levels } from "@/content/levels";
import { cn } from "@/lib/utils";
import { shellMessages } from "@/messages/id";
import { completedItemIds, levelPanel, PRACTICE_COUNT, type PipState } from "../levels/level-panel";
import { loadProgress } from "../progress";

const CARD = "flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-4";
const LABEL = "font-mono text-[10.5px] leading-[1.2] font-bold tracking-[0.1em] uppercase";

const STATE_LABEL: Record<LevelState, string> = {
  passed: "Passed",
  active: "Active",
  locked: "Locked",
  under_construction: "Under Construction",
};

const STATE_ICON = { passed: Check, active: Flame, locked: Lock, under_construction: Construction } as const;

const PIP: Record<PipState, string> = {
  done: "bg-primary",
  next: "bg-[repeating-linear-gradient(-45deg,var(--glow)_0_3px,transparent_3px_6px)] shadow-[inset_0_0_0_1.5px_var(--primary)]",
  pending: "bg-card shadow-[inset_0_0_0_1.5px_var(--muted-foreground)]",
};

/** The active level's Practice Pips and count, from the same view model as /levels. */
function activeCallout(level: LevelProgress): { pips: PipState[]; doneCount: number } {
  const mod = levels.find((candidate) => candidate.number === level.number);
  if (!mod) return { pips: Array(PRACTICE_COUNT).fill("pending"), doneCount: level.practicesDone.size };
  const panel = levelPanel(mod, completedItemIds(mod, [level]));
  return { pips: panel.pips, doneCount: panel.doneCount };
}

/**
 * Level Path (DESIGN.md › Dashboard; EXPERIENCE.md): Level 1 → Ujian Akhir as
 * an ordered list, each node passed / active (`aria-current="step"`) /
 * locked / Under Construction; the active node carries Practice Pips and
 * "x/5 practices done". Pure view of `levelProgress`; no motion.
 */
export function LevelPathView({ progress }: { progress: readonly LevelProgress[] }) {
  return (
    <nav aria-label="Level path" className="w-full rounded-lg border border-border bg-card p-4 sm:p-[22px]">
      <ol className="flex flex-col gap-2">
        {progress.map((level) => {
          const Icon = STATE_ICON[level.state];
          const active = level.state === "active";
          const muted = level.state === "locked" || level.state === "under_construction";
          const callout = active ? activeCallout(level) : null;
          return (
            <li
              key={level.number}
              data-state={level.state}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex flex-col gap-2 rounded-md px-3 py-2",
                active && "bg-muted shadow-[inset_0_0_0_1.5px_var(--primary)]",
                muted && "text-muted-foreground",
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Icon aria-hidden="true" className={cn("size-4 shrink-0", !muted && "text-primary")} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-bold">Level {level.number}</span> <span lang="id">{level.name}</span>
                </span>
                <span className={cn(LABEL, "shrink-0")}>{STATE_LABEL[level.state]}</span>
              </div>
              {callout && (
                <div className="flex items-center gap-3">
                  <div aria-hidden="true" className="flex flex-1 gap-1">
                    {callout.pips.map((pip, index) => (
                      <span key={index} data-pip={pip} className={cn("h-2 flex-1 rounded-[3px]", PIP[pip])} />
                    ))}
                  </div>
                  <span className="text-xs leading-[1.4] font-medium whitespace-nowrap text-muted-foreground">
                    {callout.doneCount}/{PRACTICE_COUNT} practices done
                  </span>
                </div>
              )}
            </li>
          );
        })}
        <li data-state="under_construction" className="flex items-center gap-3 rounded-md px-3 py-2 text-muted-foreground">
          <Flag aria-hidden="true" className="size-4 shrink-0" />
          <span lang="id" className="min-w-0 flex-1 truncate font-bold">
            {FINAL_EXAM_NAME}
          </span>
          <span className={cn(LABEL, "shrink-0")}>{STATE_LABEL.under_construction}</span>
        </li>
      </ol>
    </nav>
  );
}

/** Server part: read progress per request; a failed read replaces the path with the first-load message. */
export async function LevelPath() {
  const progress = await loadProgress();
  if (progress === "failed") {
    return (
      <div className={CARD}>
        <p role="alert" lang="id">
          {shellMessages.firstLoadFailed}
        </p>
        {/* A full reload, as the other first-load alerts do. */}
        <a href="/dashboard" className="font-bold text-primary underline-offset-4 hover:underline">
          Try again
        </a>
      </div>
    );
  }
  return <LevelPathView progress={progress} />;
}

/** Shaped like the path: the active node with its pips, then nine rows. */
export function LevelPathSkeleton() {
  return (
    <div
      aria-hidden="true"
      data-slot="level-path-skeleton"
      className="flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-4 sm:p-[22px]"
    >
      <div className="h-[60px] rounded-md bg-muted" />
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className="h-9 rounded-md bg-muted" />
      ))}
    </div>
  );
}
