import type { Metadata } from "next";
import { surfaceTitle } from "@/components/shell/nav-items";
import { PageTitle } from "@/components/shell/page-title";
import { levels } from "@/content/levels";
import { shellMessages } from "@/messages/id";
import { loadOpenAttempt } from "../open-attempt";
import { loadProgress } from "../progress";
import { LevelDetailPanel } from "./level-detail-panel";
import { completedItemIds } from "./level-panel";
import { BLOCKED_MESSAGE, type StartLock } from "./start-lock";

export const metadata: Metadata = { title: surfaceTitle("Level Map") };

/**
 * Level Map: the Level Detail Panel of the active level (`loadProgress`, the
 * same read as the Dashboard's Level Path, so both agree; the first V1 level
 * when none is active), inline, with its practices done. A failed progress
 * read shows the first-load message with Try again instead of the panel, as
 * the Dashboard does. The Level Map around the panel and its `Sheet` come
 * later in epic 4. While an attempt is in progress
 * (`loadOpenAttempt`, read per request) Start is locked with
 * `BLOCKED_MESSAGE` and a link to that attempt. A failed read locks nothing:
 * the database still refuses a second attempt, and Start's `blocked` answer
 * is the backstop.
 */
export default async function Page() {
  const [loaded, progress] = await Promise.all([loadOpenAttempt(), loadProgress()]);
  const startLock: StartLock | undefined =
    loaded !== null && loaded !== "failed" ? { reason: BLOCKED_MESSAGE, attemptId: loaded.attempt.id } : undefined;
  if (progress === "failed") {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle>Level Map</PageTitle>
        <div className="flex w-full flex-col gap-2 rounded-lg border border-border bg-card p-4 lg:max-w-[400px]">
          <p role="alert" lang="id">
            {shellMessages.firstLoadFailed}
          </p>
          <a href="/levels" className="font-bold text-primary underline-offset-4 hover:underline">
            Try again
          </a>
        </div>
      </div>
    );
  }
  const active = progress.find((entry) => entry.state === "active");
  const level =
    (active && levels.find((candidate) => candidate.number === active.number)) ?? levels.find((candidate) => candidate.phase === "v1");
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Level Map</PageTitle>
      {level && <LevelDetailPanel level={level} completed={completedItemIds(level, progress)} startLock={startLock} />}
    </div>
  );
}
