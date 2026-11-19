import type { Metadata } from "next";
import { Suspense } from "react";
import { surfaceTitle } from "@/components/shell/nav-items";
import { PageTitle } from "@/components/shell/page-title";
import { TipsList, TipsSkeleton } from "./tips-list";

export const metadata: Metadata = { title: surfaceTitle("Tips & Tricks") };

/**
 * Tips & Tricks (CAP-8): every Tip stored on the user's graded Results, one
 * card per Tip id, with a level filter and search. Read through the session
 * (AD-9, RLS: owner only); derived from stored Results (AD-7, no table).
 */
export default function TipsPage() {
  return (
    <div className="page-enter flex flex-col gap-6">
      <PageTitle>Tips &amp; Tricks</PageTitle>
      <Suspense fallback={<TipsSkeleton />}>
        <TipsList />
      </Suspense>
    </div>
  );
}
