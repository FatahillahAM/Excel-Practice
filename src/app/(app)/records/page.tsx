import type { Metadata } from "next";
import { Suspense } from "react";
import { surfaceTitle } from "@/components/shell/nav-items";
import { PageTitle } from "@/components/shell/page-title";
import { RecordsList, RecordsSkeleton } from "./records-list";

export const metadata: Metadata = { title: surfaceTitle("Records") };

/**
 * Records (CAP-11): the best time per item, derived per request from the
 * user's graded attempts (`loadRecords`, the same read as progress; AD-7, no
 * table), with Practice again per row.
 */
export default function Page() {
  return (
    <div className="page-enter flex flex-col gap-6">
      <PageTitle>Records</PageTitle>
      <Suspense fallback={<RecordsSkeleton />}>
        <RecordsList />
      </Suspense>
    </div>
  );
}
