import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { readResult } from "@/adapters/supabase/attempts";
import { getSessionUser } from "@/adapters/supabase/auth";
import { loginRedirectPath } from "@/adapters/supabase/auth-rules";
import { createClient } from "@/adapters/supabase/server";
import { surfaceTitle } from "@/components/shell/nav-items";
import { PageTitle } from "@/components/shell/page-title";
import { itemLabel } from "@/core/content/level-module";
import { resultSchema, type Result } from "@/core/grading";
import { findItem } from "@/content/levels";
import { shellMessages } from "@/messages/id";

export const metadata: Metadata = { title: surfaceTitle("Results"), robots: { index: false } };

const CARD = "flex flex-col gap-2 rounded-lg border border-border bg-card p-4";

/**
 * Results of a graded attempt (`/results/<attemptId>`; the Result id is the
 * attempt id). Rendered from the stored `Result` only (AD-3), read through the
 * user's session (AD-9) and validated with `resultSchema`: the item, the score
 * out of 100 and "x of y correct". Missing (not the user's, not graded, or
 * graded by SQL before results existed) → 404; invalid or unreadable → the
 * first-load alert. Per-question reasons, Tips and the rest arrive with entry 6.
 */
export default function ResultsPage({ params }: { params: Promise<{ attemptId: string }> }) {
  return (
    <div className="page-enter flex flex-col gap-6">
      <Suspense fallback={<ResultsSkeleton />}>
        <Results params={params} />
      </Suspense>
    </div>
  );
}

async function Results({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const path = `/results/${encodeURIComponent(attemptId)}`;

  const loaded = await loadResult(attemptId, path);
  if (loaded === null) notFound();
  if (loaded === "failed") {
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

  const { itemId, result } = loaded;
  const found = findItem(itemId);
  const label = found ? `Level ${found.level.number} · ${itemLabel(found.item)}` : itemId;

  return (
    <>
      <PageTitle>Results</PageTitle>
      <section aria-label="Score" className={`${CARD} w-full lg:max-w-[400px]`}>
        <p className="text-[15px] font-semibold text-muted-foreground">{label}</p>
        <p className="font-mono text-[40px] leading-none font-[850] tabular-nums">
          {result.score}
          <span className="text-[20px] text-muted-foreground">/100</span>
        </p>
        <p className="text-[15px] font-semibold">{`${result.correctCount} of ${result.questionCount} correct`}</p>
      </section>
      <Link href="/dashboard" className="font-bold text-primary underline-offset-4 hover:underline">
        Back to Dashboard
      </Link>
    </>
  );
}

type LoadedResult = { itemId: string; result: Result };

/** The stored Result through the user's session; `null` when there is none for this user. */
async function loadResult(attemptId: string, path: string): Promise<LoadedResult | null | "failed"> {
  try {
    const user = await getSessionUser();
    if (!user) redirect(loginRedirectPath(path, ""));
    const read = await readResult(await createClient(), attemptId);
    if (!read.ok) return "failed";
    if (read.value === null) return null;
    const parsed = resultSchema.safeParse(read.value.result);
    if (!parsed.success) {
      console.error(JSON.stringify({ event: "results.load_failed", attemptId, code: "result_invalid" }));
      return "failed";
    }
    return { itemId: read.value.itemId, result: parsed.data };
  } catch (error) {
    // `redirect()` and Next's prerender interrupts are not failures.
    unstable_rethrow(error);
    console.error(JSON.stringify({ event: "results.load_failed", attemptId, code: (error as Error)?.name ?? "unknown" }));
    return "failed";
  }
}

function ResultsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <div className="h-9 w-40 rounded-sm bg-muted" />
      <div className="h-[120px] w-full rounded-lg bg-muted lg:max-w-[400px]" />
    </div>
  );
}
