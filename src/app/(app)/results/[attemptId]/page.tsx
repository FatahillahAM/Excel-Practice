import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { loginRedirectPath } from "@/adapters/supabase/auth-rules";
import { ResultsView } from "@/components/results/results-view";
import { surfaceTitle } from "@/components/shell/nav-items";
import { attemptDurationSeconds } from "@/core/services/attempts";
import { findItem } from "@/content/levels";
import { loadResult, outcomeOf, ResultsLoadFailed, ResultsSkeleton } from "../load-result";

type Params = { params: Promise<{ attemptId: string }> };

/**
 * The document title carries the outcome ("Practice 1 — 85/100 · …") once the
 * Result is read; "Results" otherwise (no session, no Result, failed read).
 * Shares the page's read (`loadResult` is `cache()`d) and never redirects.
 */
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { attemptId } = await params;
  const loaded = await loadResult(attemptId);
  const title = loaded.status === "loaded" ? outcomeOf(loaded).heading : "Results";
  return { title: surfaceTitle(title), robots: { index: false } };
}

/**
 * Results of a graded attempt (`/results/<attemptId>`; the Result id is the
 * attempt id). Rendered from the stored `Result` only (AD-3), read through the
 * user's session (AD-9) and validated with `resultSchema`, plus the attempt's
 * time (`received_at − started_at`, AD-8). Missing (not the user's, not graded,
 * or graded by SQL before results existed) → 404; invalid or unreadable → the
 * first-load alert. The exam screen navigates here by itself: focus moves to
 * the `<h1>` (`ResultsFocus`), of the outcome and of the alert alike.
 */
export default function ResultsPage({ params }: Params) {
  return (
    <div className="page-enter flex flex-col gap-6">
      <Suspense fallback={<ResultsSkeleton />}>
        <Results params={params} />
      </Suspense>
    </div>
  );
}

async function Results({ params }: Params) {
  const { attemptId } = await params;
  const path = `/results/${encodeURIComponent(attemptId)}`;

  const loaded = await loadResult(attemptId);
  if (loaded.status === "login") redirect(loginRedirectPath(path, ""));
  if (loaded.status === "missing") notFound();
  if (loaded.status === "failed" || loaded.status === "invalid") return <ResultsLoadFailed path={path} focus />;

  const found = findItem(loaded.itemId);
  return (
    <ResultsView
      mode="live"
      itemId={loaded.itemId}
      item={found ? { kind: found.item.kind, number: found.item.number } : null}
      level={found ? { number: found.level.number, name: found.level.name } : null}
      result={loaded.result}
      durationSeconds={attemptDurationSeconds(loaded.startedAt, loaded.receivedAt)}
    />
  );
}
