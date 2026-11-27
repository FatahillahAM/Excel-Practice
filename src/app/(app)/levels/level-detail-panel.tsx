import { Lock } from "lucide-react";
import { STATE_ICON, STATE_LABEL } from "@/components/levels/level-node";
import type { LevelModule } from "@/core/content/level-module";
import { V1_LAST_LEVEL, type ItemRecord, type LevelState } from "@/core/progress";
import { formatElapsed } from "@/core/services/attempts/elapsed";
import { cn } from "@/lib/utils";
import {
  levelPanel,
  lockedReason,
  PRACTICE_COUNT,
  testLockLine,
  TEST_UNAVAILABLE_LINE,
  V1_END_LINE,
  type PipState,
  type PracticeStatus,
  type TestResult,
} from "./level-panel";
import { MateriSheet } from "@/components/materi/materi-sheet";
import { StartControl } from "./start-control";
import type { StartLock } from "./start-lock";

const LABEL = "font-mono text-[11px] leading-[1.2] font-bold tracking-[0.1em] uppercase";
const CAPTION = "text-xs leading-[1.4] font-medium";
const VALUE = "font-mono text-[15px] font-semibold text-muted-foreground tabular-nums";
/** An item without a graded (or timed) attempt yet. */
const NO_VALUE = "—";
const PANEL = "flex w-full max-w-[430px] flex-col gap-[14px] rounded-lg border border-border bg-card p-4 sm:p-[22px]";
const HEADING = "text-[32px] leading-[1.1] font-[850] tracking-[-0.025em] outline-none";

/** The eyebrow: the state icon, "Level N · <state>" (or the state alone without a number). */
function Eyebrow({ number, state }: { number: number | null; state: LevelState }) {
  const Icon = STATE_ICON[state];
  const open = state === "active" || state === "passed";
  return (
    <p data-slot="panel-eyebrow" className={cn(LABEL, "flex items-center gap-1.5", open ? "text-primary" : "text-muted-foreground")}>
      <Icon aria-hidden="true" className={cn("size-3.5", state === "locked" && "text-warning")} />
      {number !== null ? `Level ${number} · ${STATE_LABEL[state]}` : STATE_LABEL[state]}
    </p>
  );
}

/**
 * The read-only Level Detail Panel of a locked or Under Construction level,
 * Ujian Akhir or the side track: eyebrow, name, functions when known, and
 * the reason (locked: "Pass Test Level N-1 to unlock.") or the Under
 * Construction Tag. No Start anywhere (CAP-1, CAP-15).
 */
export function ReadOnlyLevelPanel({
  idBase,
  number,
  name,
  state,
  functions,
}: {
  idBase: string;
  number: number | null;
  name: string;
  state: "locked" | "under_construction";
  functions?: readonly string[];
}) {
  const headingId = `${idBase}-heading`;
  return (
    <section aria-labelledby={headingId} data-readonly="true" className={PANEL}>
      <div className="flex flex-col gap-1">
        <Eyebrow number={number} state={state} />
        <h2 id={headingId} lang="id" className={HEADING} tabIndex={-1}>
          {name}
        </h2>
        {functions && functions.length > 0 && (
          <p className="font-mono text-xs leading-[1.4] text-muted-foreground">{functions.join(" · ")}</p>
        )}
      </div>
      {state === "locked" && number !== null ? (
        <p id={`${idBase}-reason`} className="flex items-center gap-1.5 font-medium text-muted-foreground">
          <Lock aria-hidden="true" className="size-4 shrink-0 text-warning" />
          {lockedReason(number)}
        </p>
      ) : (
        <p>
          <span
            data-slot="under-construction-tag"
            className={cn(LABEL, "inline-block rounded-[6px] border border-dashed border-border px-2 py-1 text-muted-foreground")}
          >
            {STATE_LABEL.under_construction}
          </span>
        </p>
      )}
    </section>
  );
}

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
 * Level Detail Panel (DESIGN.md, EXPERIENCE.md; `key-level-map.html`), opened
 * from a Level Map node (side panel; bottom sheet on a phone). Eyebrow per
 * state, best score and record time per row (`records()`, 4.4). Header,
 * Practice Pips with "x/5 practices done", one row per practice and the
 * Test, and one Primary Button in the foot for the next item ("Start
 * Practice N", "Start Test", "Try the Test again"). Done practices and a
 * passed Test carry "Practice again" (CAP-11; never changes pips, gate or
 * level status). `startLock` (an attempt in progress) disables every one of
 * them, with its reason shown once. Level 4 passed shows the V1 end line.
 * Each Practice with content opens its Materi Sheet (5.7): the next one from
 * a row right above Start, the others from their row; it never gates Start.
 */
export function LevelDetailPanel({
  level,
  completed = new Set<string>(),
  result,
  state = "active",
  startLock,
  records,
  bestScores,
}: {
  level: LevelModule;
  completed?: ReadonlySet<string>;
  result?: TestResult;
  /** The level's progress state (`levelProgress`); locked / Under Construction show the read-only panel. */
  state?: LevelState;
  startLock?: StartLock;
  /** Record time per item (`records()`, 4.4). */
  records?: ReadonlyMap<string, ItemRecord>;
  /** Best score per item (`bestScores()`). */
  bestScores?: ReadonlyMap<string, number>;
}) {
  if (state === "locked" || state === "under_construction") {
    return <ReadOnlyLevelPanel idBase={`level-${level.id}`} number={level.number} name={level.name} state={state} functions={level.functions} />;
  }
  const best = (itemId: string | null) => {
    const score = itemId ? bestScores?.get(itemId) : undefined;
    return score === undefined ? NO_VALUE : String(score);
  };
  const time = (itemId: string | null) => {
    const record = itemId ? records?.get(itemId) : undefined;
    return record ? formatElapsed(record.seconds) : NO_VALUE;
  };
  const panel = levelPanel(level, completed, result);
  // The next Practice's Materi sits right above its Start (5.7); the other practices carry theirs in their row.
  const nextPractice = panel.practices.find((practice) => practice.status === "next");
  const headingId = `level-${level.id}-heading`;
  const passed = state === "passed";
  // The lock reason is shown once: under the Primary Button, else in its own line.
  const lockLineId = panel.primary ? `start-${panel.primary.itemId}-lock` : `level-${level.id}-lock`;
  const again = (itemId: string) => (
    <div className="pt-1.5">
      <StartControl itemId={itemId} text="Practice again" variant="secondary" lock={startLock} reasonId={startLock ? lockLineId : undefined} />
    </div>
  );

  return (
    <section aria-labelledby={headingId} className={PANEL}>
      <div className="flex flex-col gap-1">
        <Eyebrow number={level.number} state={passed ? "passed" : "active"} />
        <h2 id={headingId} lang="id" className={HEADING} tabIndex={-1}>
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
                        Best {best(practice.itemId)} · {time(practice.itemId)}
                      </span>
                    )}
                    {practice.status !== "next" && <MateriSheet itemLabel={practice.label} cards={practice.materi} />}
                    {practice.practiceAgain && practice.itemId && again(practice.itemId)}
                  </td>
                  <td className={cn(VALUE, "hidden px-2 sm:table-cell")}>{best(practice.itemId)}</td>
                  <td data-slot="record-time" className={cn(VALUE, "hidden px-3 sm:table-cell")}>
                    {time(practice.itemId)}
                  </td>
                </tr>
              );
            })}
            <tr className="h-[52px] border-t border-border bg-accent/55">
              <td className="px-3 py-1.5">
                <span
                  className={cn(
                    "block font-bold",
                    (panel.test.status === "locked" || panel.test.status === "unavailable") && "text-muted-foreground",
                  )}
                >
                  {panel.test.label}
                </span>
                {panel.test.status === "locked" && (
                  <span className={cn(CAPTION, "flex items-center gap-1.5 text-muted-foreground")}>
                    <Lock aria-hidden="true" className="size-[13px] shrink-0 text-warning" />
                    {testLockLine(panel.test.toGo)}
                  </span>
                )}
                {panel.test.status === "open" && <span className={cn(CAPTION, "block text-primary")}>Open</span>}
                {panel.test.status === "passed" && <span className={cn(CAPTION, "block text-primary")}>✓ Passed</span>}
                {panel.test.status === "failed" && (
                  <span className={cn(CAPTION, "block text-muted-foreground")}>Not passed yet</span>
                )}
                {panel.test.status === "unavailable" && (
                  <>
                    <span className={cn(CAPTION, "block text-muted-foreground")}>{PRACTICE_STATUS.unavailable}</span>
                    <span data-slot="test-unavailable" className={cn(CAPTION, "block text-muted-foreground")}>
                      {TEST_UNAVAILABLE_LINE}
                    </span>
                  </>
                )}
                <span className={cn(CAPTION, "block text-muted-foreground sm:hidden")}>
                  Best {best(panel.test.itemId)} · {time(panel.test.itemId)}
                </span>
                {panel.test.practiceAgain && panel.test.itemId && again(panel.test.itemId)}
              </td>
              <td className={cn(VALUE, "hidden px-2 sm:table-cell")}>{best(panel.test.itemId)}</td>
              <td data-slot="record-time" className={cn(VALUE, "hidden px-3 sm:table-cell")}>
                {time(panel.test.itemId)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {level.number === V1_LAST_LEVEL && panel.test.status === "passed" && (
        <p className="font-bold text-primary">{V1_END_LINE}</p>
      )}

      {nextPractice && (
        <div data-slot="materi-next" className="pt-1">
          <MateriSheet itemLabel={nextPractice.label} cards={nextPractice.materi} prominent />
        </div>
      )}

      {panel.primary ? (
        <div className="pt-1">
          <StartControl itemId={panel.primary.itemId} text={panel.primary.text} lock={startLock} fullWidth />
        </div>
      ) : (
        startLock && (
          <p id={lockLineId} className="text-xs leading-[1.4] font-medium text-muted-foreground">
            {startLock.reason}
            {startLock.attemptId && (
              <>
                {" "}
                <a href={`/exam/${startLock.attemptId}`} className="font-bold text-primary underline-offset-4 hover:underline">
                  Go to the attempt
                </a>
              </>
            )}
          </p>
        )
      )}
    </section>
  );
}
