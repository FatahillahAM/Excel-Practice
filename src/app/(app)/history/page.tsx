import type { Metadata } from "next";
import { Suspense } from "react";
import { surfaceTitle } from "@/components/shell/nav-items";
import { PageTitle } from "@/components/shell/page-title";
import { HistoryList, HistorySkeleton } from "./history-list";

export const metadata: Metadata = { title: surfaceTitle("History") };

/**
 * History (CAP-21): the user's graded attempts with a schema-valid Result,
 * newest first (at most 50), read through the session (AD-9, RLS: owner
 * only). Each row opens `/history/<id>`, the stored Result in static mode.
 */
export default function HistoryPage() {
  return (
    <div className="page-enter flex flex-col gap-6">
      <PageTitle>History</PageTitle>
      <Suspense fallback={<HistorySkeleton />}>
        <HistoryList />
      </Suspense>
    </div>
  );
}
