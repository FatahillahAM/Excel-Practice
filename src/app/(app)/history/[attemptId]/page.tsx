import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { loginRedirectPath } from "@/adapters/supabase/auth-rules";
import { ResultsView } from "@/components/results/results-view";
import { surfaceTitle } from "@/components/shell/nav-items";
import { attemptDurationSeconds } from "@/core/services/attempts";
import { itemView } from "@/content/levels";
import { isListable } from "../history-rows";
import { loadResult, outcomeOf, ResultsLoadFailed, ResultsSkeleton, type LoadState } from "../../results/load-result";

type Params = { params: Promise<{ attemptId: string }> };

/**
 * Only what the History list would show: a `graded` / `closed` attempt with a
 * schema-valid Result. Anything else (incl. an invalid Result) is `missing`
 * (404); a read that could not be answered stays `failed` (the alert).
 */
async function loadHistoryResult(attemptId: string): Promise<LoadState> {
  const loaded = await loadResult(attemptId);
  if (loaded.status === "invalid") return { status: "missing" };
  if (loaded.status === "loaded" && !isListable(loaded.attemptStatus)) return { status: "missing" };
  return loaded;
}

/** The outcome heading like live Results; "History" otherwise. */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { attemptId } = await params;
  const loaded = await loadHistoryResult(attemptId);
  const title = loaded.status === "loaded" ? outcomeOf(loaded).heading : "History";
  return { title: surfaceTitle(title), robots: { index: false } };
}

/**
 * History detail (`/history/<attemptId>`): the stored Result through the same
 * loader as live Results, rendered `mode="static"` (no motion, focus stays).
 * No session → login back here; not listable (status, missing or invalid
 * Result) → 404; unreadable → the first-load alert under "History".
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

  const loaded = await loadHistoryResult(attemptId);
  if (loaded.status === "login") redirect(loginRedirectPath(path, ""));
  if (loaded.status === "missing" || loaded.status === "invalid") notFound();
  if (loaded.status === "failed") return <ResultsLoadFailed path={path} focus={false} title="History" />;

  const view = itemView(loaded.itemId);
  return (
    <ResultsView
      mode="static"
      itemId={loaded.itemId}
      item={view.item}
      level={view.level}
      result={loaded.result}
      durationSeconds={attemptDurationSeconds(loaded.startedAt, loaded.receivedAt)}
    />
  );
}
