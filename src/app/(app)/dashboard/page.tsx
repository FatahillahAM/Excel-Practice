import type { Metadata } from "next";
import { Suspense } from "react";
import { surfaceTitle } from "@/components/shell/nav-items";
import { PageTitle } from "@/components/shell/page-title";
import { shellMessages } from "@/messages/id";
import { attemptCardView, loadOpenAttempt } from "../open-attempt";
import { AttemptCard, DASHBOARD_TITLE_ID } from "./attempt-card";
import { LevelPath, LevelPathSkeleton } from "./level-path";

export const metadata: Metadata = { title: surfaceTitle("Dashboard") };

/**
 * Dashboard: the title, the Level Path (progress read in its own Suspense
 * boundary; a failed read replaces only the path) and the rail column, whose
 * first card is the Attempt Card while an attempt is in progress (DESIGN.md ›
 * Layout › Dashboard grid; Streak Hero and the rest of the rail come later in
 * epic 4). Read on the server per request (`loadOpenAttempt`), no
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
        {loaded !== null && (
          <div className="flex w-full flex-col gap-[14px] lg:max-w-[400px]">
            {loaded === "failed" ? (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
