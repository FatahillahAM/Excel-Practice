import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { loginRedirectPath } from "@/adapters/supabase/auth-rules";
import { ResultsView } from "@/components/results/results-view";
import { surfaceTitle } from "@/components/shell/nav-items";
import { attemptDurationSeconds } from "@/core/services/attempts";
import { findItem } from "@/content/levels";
import { loadResult, outcomeOf, ResultsLoadFailed, ResultsSkeleton } from "../../results/load-result";

type Params = { params: Promise<{ attemptId: string }> };

/** Same title as live Results: the outcome heading, "Results" otherwise. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { attemptId } = await params;
  const loaded = await loadResult(attemptId);
  const title = loaded.status === "loaded" ? outcomeOf(loaded).heading : "Results";
  return { title: surfaceTitle(title), robots: { index: false } };
}

/**
 * History detail (`/history/<attemptId>`): the stored Result through the same
 * loader as live Results, rendered `mode="static"` (no motion, focus stays).
 * No session → login back here; missing → 404; invalid or unreadable → the
 * first-load alert.
 */
export default function HistoryDetailPage({ params }: Params) {
  return (
    <div className="page-enter flex flex-col gap-6">
      <Link href="/history" className="self-start text-[14px] font-bold text-primary underline-offset-4 hover:underline">
        Back to History
      </Link>
      <Suspense fallback={<ResultsSkeleton />}>
        <HistoryDetail params={params} />
      </Suspense>
    </div>
  );
}

async function HistoryDetail({ params }: Params) {
  const { attemptId } = await params;
  const path = `/history/${encodeURIComponent(attemptId)}`;

  const loaded = await loadResult(attemptId);
  if (loaded.status === "login") redirect(loginRedirectPath(path, ""));
  if (loaded.status === "missing") notFound();
  if (loaded.status === "failed") return <ResultsLoadFailed path={path} focus={false} />;

  const found = findItem(loaded.itemId);
  return (
    <ResultsView
      mode="static"
      itemId={loaded.itemId}
      item={found ? { kind: found.item.kind, number: found.item.number } : null}
      level={found ? { number: found.level.number, name: found.level.name } : null}
      result={loaded.result}
      durationSeconds={attemptDurationSeconds(loaded.startedAt, loaded.receivedAt)}
    />
  );
}
