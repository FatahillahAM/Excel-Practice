import type { Metadata } from "next";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { Suspense, cache } from "react";
import { readResult } from "@/adapters/supabase/attempts";
import { getSessionUser } from "@/adapters/supabase/auth";
import { loginRedirectPath } from "@/adapters/supabase/auth-rules";
import { createClient } from "@/adapters/supabase/server";
import { resultsOutcome } from "@/components/results/outcome";
import { ResultsView } from "@/components/results/results-view";
import { surfaceTitle } from "@/components/shell/nav-items";
import { PageTitle } from "@/components/shell/page-title";
import { resultSchema, type Result } from "@/core/grading";
import { attemptDurationSeconds } from "@/core/services/attempts";
import { findItem } from "@/content/levels";
import { shellMessages } from "@/messages/id";

type Params = { params: Promise<{ attemptId: string }> };

const CARD = "flex flex-col gap-2 rounded-lg border border-border bg-card p-4";

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
 * first-load alert. The exam screen navigates here by itself: `ResultsView` in
 * `live` mode moves focus to the `<h1>`.
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
  if (loaded.status === "failed") {
    return (
      <>
        <PageTitle>Results</PageTitle>
        <div className={`${CARD} w-full lg:max-w-[400px]`}>
          <p role="alert" lang="id">
            {shellMessages.firstLoadFailed}
          </p>
          <a href={path} className="font-bold text-primary underline-offset-4 hover:underline">
            Try again
          </a>
        </div>
      </>
    );
  }

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

type Loaded = { status: "loaded"; itemId: string; result: Result; startedAt: string; receivedAt: string | null };
type LoadState = { status: "login" } | { status: "missing" } | { status: "failed" } | Loaded;

function outcomeOf(loaded: Loaded) {
  const found = findItem(loaded.itemId);
  return resultsOutcome({
    item: found ? { kind: found.item.kind, number: found.item.number } : null,
    itemId: loaded.itemId,
    result: loaded.result,
  });
}

/**
 * The stored Result through the user's session, once per request (`cache()`:
 * `generateMetadata` and the page share it). `login` without a session (the
 * page redirects, not this), `missing` when there is none for this user.
 */
const loadResult = cache(async (attemptId: string): Promise<LoadState> => {
  try {
    const user = await getSessionUser();
    if (!user) return { status: "login" };
    const read = await readResult(await createClient(), attemptId);
    if (!read.ok) return { status: "failed" };
    if (read.value === null) return { status: "missing" };
    const parsed = resultSchema.safeParse(read.value.result);
    if (!parsed.success) {
      console.error(JSON.stringify({ event: "results.load_failed", attemptId, code: "result_invalid" }));
      return { status: "failed" };
    }
    return {
      status: "loaded",
      itemId: read.value.itemId,
      result: parsed.data,
      startedAt: read.value.startedAt,
      receivedAt: read.value.receivedAt,
    };
  } catch (error) {
    // Next's prerender interrupts are not failures.
    unstable_rethrow(error);
    console.error(JSON.stringify({ event: "results.load_failed", attemptId, code: (error as Error)?.name ?? "unknown" }));
    return { status: "failed" };
  }
});

function ResultsSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto flex w-full max-w-[880px] flex-col gap-7">
      <div className="h-[240px] w-full rounded-lg bg-muted" />
      <div className="h-[120px] w-full rounded-lg bg-muted" />
    </div>
  );
}
