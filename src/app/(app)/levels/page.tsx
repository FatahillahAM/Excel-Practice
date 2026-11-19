import type { Metadata } from "next";
import { surfaceTitle } from "@/components/shell/nav-items";
import { PageTitle } from "@/components/shell/page-title";
import { levels } from "@/content/levels";
import { loadOpenAttempt } from "../open-attempt";
import { loadProgress } from "../progress";
import { LevelDetailPanel } from "./level-detail-panel";
import { completedItemIds } from "./level-panel";
import { BLOCKED_MESSAGE, type StartLock } from "./start-lock";

export const metadata: Metadata = { title: surfaceTitle("Level Map") };

/**
 * Level Map: the Level Detail Panel of the first V1 level in the registry
 * inline, with its practices done from `loadProgress` (the Dashboard's Level
 * Path reads the same, so both agree; a failed read shows no progress here,
 * the Dashboard carries the alert). The Level Map around the panel and its
 * `Sheet` come later in epic 4. While an attempt is in progress
 * (`loadOpenAttempt`, read per request) Start is locked with
 * `BLOCKED_MESSAGE` and a link to that attempt. A failed read locks nothing:
 * the database still refuses a second attempt, and Start's `blocked` answer
 * is the backstop.
 */
export default async function Page() {
  const [loaded, progress] = await Promise.all([loadOpenAttempt(), loadProgress()]);
  const startLock: StartLock | undefined =
    loaded !== null && loaded !== "failed" ? { reason: BLOCKED_MESSAGE, attemptId: loaded.attempt.id } : undefined;
  const level = levels.find((candidate) => candidate.phase === "v1");
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Level Map</PageTitle>
      {level && (
        <LevelDetailPanel
          level={level}
          completed={progress === "failed" ? undefined : completedItemIds(level, progress)}
          startLock={startLock}
        />
      )}
    </div>
  );
}
