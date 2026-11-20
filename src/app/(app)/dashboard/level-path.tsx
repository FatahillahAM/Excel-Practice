import { Lock } from "lucide-react";
import { LevelNodeRow } from "@/components/levels/level-node";
import type { LevelModule } from "@/core/content/level-module";
import { FINAL_EXAM_NAME, V1_LAST_LEVEL, v1Complete, type LevelProgress } from "@/core/progress";
import { levels } from "@/content/levels";
import { cn } from "@/lib/utils";
import { shellMessages } from "@/messages/id";
import {
  completedItemIds,
  levelPanel,
  PRACTICE_COUNT,
  testLockLine,
  testResult,
  V1_END_LINE,
  type LevelPanel,
  type PipState,
} from "../levels/level-panel";
import { StartControl } from "../levels/start-control";
import type { StartLock } from "../levels/start-lock";
import { loadProgress } from "../progress";

const CARD = "flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-4";

const PIP: Record<PipState, string> = {
  done: "bg-primary",
  next: "bg-[repeating-linear-gradient(-45deg,var(--glow)_0_3px,transparent_3px_6px)] shadow-[inset_0_0_0_1.5px_var(--primary)]",
  pending: "bg-card shadow-[inset_0_0_0_1.5px_var(--muted-foreground)]",
};

/** The active level's panel view (pips, count, Primary Button, Test), from the same view model as /levels. */
function activeCallout(level: LevelProgress, modules: readonly LevelModule[]): LevelPanel {
  // "active" implies a module of the registry `levelProgress` read.
  const mod = modules.find((candidate) => candidate.number === level.number)!;
  return levelPanel(mod, completedItemIds(mod, [level]), testResult(mod, [level]));
}

/**
 * Level Path (DESIGN.md › Dashboard; EXPERIENCE.md): Level 1 → Ujian Akhir as
 * an ordered list, each node passed / active (`aria-current="step"`) /
 * locked / Under Construction; the active node carries Practice Pips and
 * "x/5 practices done" and the Level Callout's Primary Button ("Start
 * Practice N" / "Start Test" / "Try the Test again"; `startLock` disables it)
 * or the Test lock line. After Level 4's Test passes, Level 4 carries the V1
 * end line and "Practice again" to /levels (the Level Detail Panel). Pure
 * view of `levelProgress` over `modules` (the registry by default); no motion.
 */
export function LevelPathView({
  progress,
  modules = levels,
  startLock,
}: {
  progress: readonly LevelProgress[];
  modules?: readonly LevelModule[];
  startLock?: StartLock;
}) {
  const v1End = v1Complete(progress);
  return (
    <nav aria-label="Level path" className="w-full rounded-lg border border-border bg-card p-4 sm:p-[22px]">
      <ol className="flex flex-col gap-2">
        {progress.map((level) => {
          const active = level.state === "active";
          const muted = level.state === "locked" || level.state === "under_construction";
          const callout = active ? activeCallout(level, modules) : null;
          return (
            <li
              key={level.number}
              data-state={level.state}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex flex-col gap-2 rounded-md px-3 py-2",
                active && "bg-muted shadow-[inset_0_0_0_1.5px_var(--primary)]",
                (active || level.state === "passed") && "glow-orbit",
                muted && "text-muted-foreground",
              )}
            >
              <LevelNodeRow node={{ key: String(level.number), number: level.number, name: level.name, state: level.state }} />
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
              {callout?.primary && (
                <StartControl itemId={callout.primary.itemId} text={callout.primary.text} lock={startLock} />
              )}
              {callout && !callout.primary && callout.test.status === "locked" && (
                <p className="flex items-center gap-1.5 text-xs leading-[1.4] font-medium text-muted-foreground">
                  <Lock aria-hidden="true" className="size-[13px] shrink-0 text-warning" />
                  {testLockLine(callout.test.toGo)}
                </p>
              )}
              {v1End && level.number === V1_LAST_LEVEL && (
                <div className="flex flex-col gap-2">
                  <p className="font-bold text-primary">{V1_END_LINE}</p>
                  <a
                    href="/levels"
                    className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-[18px] font-bold text-primary-foreground shadow-[0_4px_0_0_var(--primary-edge)] sm:w-auto sm:self-start"
                  >
                    Practice again
                  </a>
                </div>
              )}
            </li>
          );
        })}
        <li data-state="under_construction" className="rounded-md px-3 py-2 text-muted-foreground">
          <LevelNodeRow node={{ key: "final", number: null, name: FINAL_EXAM_NAME, state: "under_construction", final: true }} />
        </li>
      </ol>
    </nav>
  );
}

/** Server part: read progress per request; a failed read replaces the path with the first-load message. */
export async function LevelPath({ startLock }: { startLock?: StartLock } = {}) {
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
  return <LevelPathView progress={progress} startLock={startLock} />;
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
