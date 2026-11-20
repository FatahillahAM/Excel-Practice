import type { Metadata } from "next";
import { surfaceTitle } from "@/components/shell/nav-items";
import { PageTitle } from "@/components/shell/page-title";
import { shellMessages } from "@/messages/id";
import { loadOpenAttempt } from "../open-attempt";
import { loadRecords } from "../progress";
import { defaultOpenLevel, LevelMapView } from "./level-map";
import { ScrollScene } from "./scroll-scene";
import { BLOCKED_MESSAGE, type StartLock } from "./start-lock";

export const metadata: Metadata = { title: surfaceTitle("Level Map") };

/**
 * Level Map: "Skip intro" first, the 3D Scroll Scene (decorative), then the
 * Level Map with the active level's Level Detail Panel open (the last passed
 * level when none is active; with neither, an empty line above the map).
 * Progress, best scores and record times come from `loadRecords` (the
 * progress read the Dashboard shares, AD-7). A failed read shows the
 * first-load message with Try again and no scene. While an attempt is in
 * progress (`loadOpenAttempt`, read per request) Start is locked with
 * `BLOCKED_MESSAGE` and a link to that attempt. A failed read locks nothing:
 * the database still refuses a second attempt, and Start's `blocked` answer
 * is the backstop.
 */
export default async function Page() {
  const [loaded, view] = await Promise.all([loadOpenAttempt(), loadRecords()]);
  const startLock: StartLock | undefined =
    loaded !== null && loaded !== "failed" ? { reason: BLOCKED_MESSAGE, attemptId: loaded.attempt.id } : undefined;
  if (view === "failed") {
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
  const { progress } = view;
  return (
    <div className="flex flex-col gap-6">
      <a
        href="#level-path"
        data-slot="skip-intro"
        className="self-start rounded-md text-sm font-bold text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        Skip intro
      </a>
      <PageTitle>Level Map</PageTitle>
      <ScrollScene progress={progress} />
      {!defaultOpenLevel(progress) && (
        <p className="rounded-lg border border-border bg-card p-4 text-muted-foreground">No level is open yet.</p>
      )}
      <LevelMapView progress={progress} records={view.records} bestScores={view.bestScores} startLock={startLock} />
    </div>
  );
}
