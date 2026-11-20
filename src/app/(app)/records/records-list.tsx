import { itemLabel, type LevelModule } from "@/core/content/level-module";
import { canStart, type ItemRecord, type LevelProgress } from "@/core/progress";
import { formatElapsed } from "@/core/services/attempts/elapsed";
import { levels } from "@/content/levels";
import { shellMessages } from "@/messages/id";
import { loadOpenAttempt } from "../open-attempt";
import { loadRecords } from "../progress";
import { StartControl } from "../levels/start-control";
import { BLOCKED_MESSAGE, type StartLock } from "../levels/start-lock";

const CARD = "flex flex-col gap-2 rounded-lg border border-border bg-card p-4";
const LINK = "font-bold text-primary underline-offset-4 hover:underline";
const DATE = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium" });

/** Server part of `/records`: the one progress read, the open attempt (Start lock), and the failed state. */
export async function RecordsList() {
  const [loaded, open] = await Promise.all([loadRecords(), loadOpenAttempt()]);
  if (loaded === "failed") {
    return (
      <div className={`${CARD} w-full lg:max-w-[400px]`}>
        <p role="alert" lang="id">
          {shellMessages.firstLoadFailed}
        </p>
        {/* A full reload, as the other first-load alerts do. */}
        <a href="/records" className={LINK}>
          Try again
        </a>
      </div>
    );
  }
  const startLock: StartLock | undefined = open !== null && open !== "failed" ? { reason: BLOCKED_MESSAGE, attemptId: open.attempt.id } : undefined;
  return <RecordsView records={loaded.records} progress={loaded.progress} modules={levels} startLock={startLock} />;
}

/**
 * Records (CAP-11): one row per item with a record — best time, the date and
 * score of that attempt — grouped by level in curriculum order (Practice 1–5,
 * then the Test). Each row's Practice again goes through the same Start
 * (`canStart`); a refused item shows no button. Empty: one line with a link to
 * Dashboard.
 */
export function RecordsView({
  records,
  progress,
  modules,
  startLock,
}: {
  records: ReadonlyMap<string, ItemRecord>;
  progress: readonly LevelProgress[];
  modules: readonly LevelModule[];
  startLock?: StartLock;
}) {
  const groups = modules
    .map((mod) => ({ mod, rows: mod.items.flatMap((item) => (records.has(item.id) ? [{ item, record: records.get(item.id)! }] : [])) }))
    .filter((group) => group.rows.length > 0);
  if (groups.length === 0) {
    return (
      <p data-slot="records-empty">
        <span lang="id">{shellMessages.recordsEmpty}</span>{" "}
        <a href="/dashboard" className={LINK}>
          Go to Dashboard
        </a>
      </p>
    );
  }
  return (
    <div className="flex w-full max-w-[880px] flex-col gap-6">
      {groups.map(({ mod, rows }) => (
        <section key={mod.number} aria-labelledby={`records-level-${mod.number}`} className="flex flex-col gap-3">
          <h2 id={`records-level-${mod.number}`} className="text-lg font-extrabold">
            Level {mod.number} — <span lang="id">{mod.name}</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {rows.map(({ item, record }) => {
              const check = canStart(progress, modules, item.id);
              const label = itemLabel(item);
              return (
                <li
                  key={item.id}
                  data-slot="record-row"
                  data-item={item.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
                    <span className="font-bold">{label}</span>
                    <span data-slot="record-time" className="font-mono text-[20px] font-extrabold tracking-[-0.04em] tabular-nums">
                      {formatElapsed(record.seconds)}
                    </span>
                    <span data-slot="record-date" className="text-[12px] text-muted-foreground">
                      {DATE.format(new Date(record.receivedAt))}
                    </span>
                    <span data-slot="record-score" className="text-[13px] text-muted-foreground">{`${record.score}/100`}</span>
                  </div>
                  {check.ok ? (
                    <StartControl
                      itemId={item.id}
                      label={label}
                      variant="secondary"
                      text={check.practiceAgain ? "Practice again" : "Try the Test again"}
                      lock={startLock}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function RecordsSkeleton() {
  return (
    <div aria-hidden="true" data-slot="records-skeleton" className="flex w-full max-w-[880px] flex-col gap-3">
      <div className="h-6 w-48 rounded-md bg-muted" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 rounded-lg bg-muted" />
      ))}
    </div>
  );
}
