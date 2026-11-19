import type { Metadata } from "next";
import { Suspense } from "react";
import { surfaceTitle } from "@/components/shell/nav-items";
import { PageTitle } from "@/components/shell/page-title";
import { shellMessages } from "@/messages/id";
import { attemptCardView, loadOpenAttempt } from "../open-attempt";
import { AttemptCard, DASHBOARD_TITLE_ID } from "./attempt-card";
import { LevelPath, LevelPathSkeleton } from "./level-path";
import { StreakHero, StreakHeroSkeleton } from "./streak-hero";

export const metadata: Metadata = { title: surfaceTitle("Dashboard") };

/**
 * Dashboard: the title, the Level Path (progress read in its own Suspense
 * boundary; a failed read replaces only the path) and the rail column: the
 * Attempt Card while an attempt is in progress, then the Streak Hero (its own
 * Suspense boundary, server-rendered); on the phone the Streak Hero comes
 * first (DESIGN.md › Layout › Dashboard grid; EXPERIENCE.md). The rest of the
 * rail comes later in epic 4. Read on the server per request (`loadOpenAttempt`), no
 * polling (AD-11); Abandon re-renders the page. Full width on the phone.
 */
export default async function DashboardPage() {
  const loaded = await loadOpenAttempt();
  return (
    <div className="flex flex-col gap-6">
      <PageTitle id={DASHBOARD_TITLE_ID} tabIndex={-1}>
        Dashboard
      </PageTitle>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex w-full min-w-0 flex-col lg:flex-1">
          <Suspense fallback={<LevelPathSkeleton />}>
            <LevelPath />
          </Suspense>
        </div>
        {/* Phone: the rail (Streak Hero, then the Attempt Card) is the first screen, above the Level Path. */}
        <div className="order-first flex w-full flex-col gap-[14px] lg:order-none lg:max-w-[400px]">
          {loaded !== null &&
            (loaded === "failed" ? (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
                <p role="alert" lang="id">
                  {shellMessages.firstLoadFailed}
                </p>
                <a href="/dashboard" className="font-bold text-primary underline-offset-4 hover:underline">
                  Try again
                </a>
              </div>
            ) : (
              <AttemptCard attemptId={loaded.attempt.id} view={attemptCardView(loaded.attempt, loaded.elapsed)} />
            ))}
          <div className="order-first flex flex-col lg:order-none">
            <Suspense fallback={<StreakHeroSkeleton />}>
              <StreakHero />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
