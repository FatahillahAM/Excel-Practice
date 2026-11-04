import { Flame, Lock } from "lucide-react";
import type { LevelModule } from "../../../core/content/level-module";
import { cn } from "../../../lib/utils";
import { levelPanel, PRACTICE_COUNT, testLockLine, type PipState, type PracticeStatus } from "./level-panel";
import { StartControl, type StartLock } from "./start-control";

const LABEL = "font-mono text-[11px] leading-[1.2] font-bold tracking-[0.1em] uppercase";
const CAPTION = "text-xs leading-[1.4] font-medium";
const VALUE = "font-mono text-[15px] font-semibold text-muted-foreground tabular-nums";
/** Best score and record time wait for the progress model (epic 4). */
const NO_VALUE = "—";

const PIP: Record<PipState, string> = {
  done: "bg-primary",
  next: "bg-[repeating-linear-gradient(-45deg,var(--glow)_0_3px,transparent_3px_6px)] shadow-[inset_0_0_0_1.5px_var(--primary)]",
  pending: "bg-card shadow-[inset_0_0_0_1.5px_var(--muted-foreground)]",
};

const PRACTICE_STATUS: Record<PracticeStatus, string> = {
  done: "✓ Done",
  next: "Next",
  not_started: "Not started",
  unavailable: "Not available yet",
};

/**
 * Level Detail Panel (DESIGN.md, EXPERIENCE.md; `key-level-map.html`), inline
 * on /levels until the Level Map (epic 4) wraps it in a `Sheet`. Header,
 * Practice Pips with "x/5 practices done", one row per practice and the
 * Test, and one Start in the foot for the next item. Rows carry no buttons.
 * `startLock` (entry 7) disables that Start with its reason.
 */
export function LevelDetailPanel({
  level,
  completed = new Set<string>(),
  startLock,
}: {
  level: LevelModule;
  completed?: ReadonlySet<string>;
  startLock?: StartLock;
}) {
  const panel = levelPanel(level, completed);
  const headingId = `level-${level.id}-heading`;

  return (
    <section
      aria-labelledby={headingId}
      className="flex w-full max-w-[430px] flex-col gap-[14px] rounded-lg border border-border bg-card p-4 sm:p-[22px]"
    >
      <div className="flex flex-col gap-1">
        <p className={cn(LABEL, "flex items-center gap-1.5 text-primary")}>
          <Flame aria-hidden="true" className="size-3.5" />
          Level {level.number} · Active
        </p>
        <h2 id={headingId} lang="id" className="text-[32px] leading-[1.1] font-[850] tracking-[-0.025em]">
          {level.name}
        </h2>
        <p className="font-mono text-xs leading-[1.4] text-muted-foreground">{level.functions.join(" · ")}</p>
      </div>

      <div className="flex items-center gap-3">
        <div aria-hidden="true" className="flex flex-1 gap-1">
          {panel.pips.map((pip, index) => (
            <span key={index} data-pip={pip} className={cn("h-2 flex-1 rounded-[3px]", PIP[pip])} />
          ))}
        </div>
        <span className={cn(CAPTION, "whitespace-nowrap text-muted-foreground")}>
          {panel.doneCount}/{PRACTICE_COUNT} practices done
        </span>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border">
        <table className="w-full border-collapse text-left">
          <thead className="bg-muted">
            <tr className={cn(LABEL, "h-[30px] text-[10.5px] tracking-[0.08em] text-muted-foreground")}>
              <th scope="col" className="px-3 font-bold">
                Item
              </th>
              <th scope="col" className="hidden px-2 font-bold sm:table-cell">
                Best
              </th>
              <th scope="col" className="hidden px-3 font-bold sm:table-cell">
                Record
              </th>
            </tr>
          </thead>
          <tbody>
            {panel.practices.map((practice) => {
              const muted = practice.status === "unavailable";
              return (
                <tr key={practice.number} className="h-[52px] border-t border-border">
                  <td className="px-3 py-1.5">
                    <span className={cn("block font-bold", muted && "text-muted-foreground")}>{practice.label}</span>
                    <span
                      className={cn(
                        CAPTION,
                        "block",
                        practice.status === "done" ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {PRACTICE_STATUS[practice.status]}
                    </span>
                    {!muted && (
                      <span className={cn(CAPTION, "block text-muted-foreground sm:hidden")}>
                        Best {NO_VALUE} · {NO_VALUE}
                      </span>
                    )}
                  </td>
                  <td className={cn(VALUE, "hidden px-2 sm:table-cell")}>{NO_VALUE}</td>
                  <td className={cn(VALUE, "hidden px-3 sm:table-cell")}>{NO_VALUE}</td>
                </tr>
              );
            })}
            <tr className="h-[52px] border-t border-border bg-accent/55">
              <td className="px-3 py-1.5">
                <span className={cn("block font-bold", panel.test.status !== "open" && "text-muted-foreground")}>
                  {panel.test.label}
                </span>
                {panel.test.status === "locked" && (
                  <span className={cn(CAPTION, "flex items-center gap-1.5 text-muted-foreground")}>
                    <Lock aria-hidden="true" className="size-[13px] shrink-0 text-warning" />
                    {testLockLine(panel.test.toGo)}
                  </span>
                )}
                {panel.test.status === "open" && <span className={cn(CAPTION, "block text-primary")}>Open</span>}
                {panel.test.status === "unavailable" && (
                  <span className={cn(CAPTION, "block text-muted-foreground")}>{PRACTICE_STATUS.unavailable}</span>
                )}
                <span className={cn(CAPTION, "block text-muted-foreground sm:hidden")}>
                  Best {NO_VALUE} · {NO_VALUE}
                </span>
              </td>
              <td className={cn(VALUE, "hidden px-2 sm:table-cell")}>{NO_VALUE}</td>
              <td className={cn(VALUE, "hidden px-3 sm:table-cell")}>{NO_VALUE}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {panel.next && (
        <div className="pt-1">
          <StartControl itemId={panel.next.itemId} label={panel.next.label} lock={startLock} fullWidth />
        </div>
      )}
    </section>
  );
}
