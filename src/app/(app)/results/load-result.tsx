import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { readResult } from "@/adapters/supabase/attempts";
import { getSessionUser } from "@/adapters/supabase/auth";
import { createClient } from "@/adapters/supabase/server";
import { resultsOutcome } from "@/components/results/outcome";
import { ResultsFocus } from "@/components/results/results-focus";
import { RESULTS_HEADING_ID } from "@/components/results/results-view";
import { PageTitle } from "@/components/shell/page-title";
import { resultSchema, type Result } from "@/core/grading";
import type { AttemptStatus } from "@/core/services/attempts";
import { findItem } from "@/content/levels";
import { shellMessages } from "@/messages/id";

/**
 * The one path from a stored `Result` to the screen, shared by live Results
 * (`/results/<id>`) and the History detail (`/history/<id>`): both render the
 * same validated Result, so score, reasons and Tips are identical.
 */

export type Loaded = {
  status: "loaded";
  itemId: string;
  /** The attempt's own status (History shows only `graded` / `closed`: `isListable` in `history/history-rows.ts`). */
  attemptStatus: AttemptStatus | undefined;
  result: Result;
  startedAt: string;
  receivedAt: string | null;
};
/**
 * `failed`: the read could not be answered (database, network); `invalid`:
 * a stored Result that fails `resultSchema` (logged). Live Results shows the
 * first-load alert for both; History treats `invalid` as not found.
 */
export type LoadState = { status: "login" } | { status: "missing" } | { status: "failed" } | { status: "invalid" } | Loaded;

const CARD = "flex flex-col gap-2 rounded-lg border border-border bg-card p-4";

export function outcomeOf(loaded: Loaded) {
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
export const loadResult = cache(async (attemptId: string): Promise<LoadState> => {
  try {
    const user = await getSessionUser();
    if (!user) return { status: "login" };
    const read = await readResult(await createClient(), attemptId);
    if (!read.ok) return { status: "failed" };
    if (read.value === null) return { status: "missing" };
    const parsed = resultSchema.safeParse(read.value.result);
    if (!parsed.success) {
      console.error(JSON.stringify({ event: "results.load_failed", attemptId, code: "result_invalid" }));
      return { status: "invalid" };
    }
    return {
      status: "loaded",
      itemId: read.value.itemId,
      attemptStatus: read.value.status,
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

/**
 * First-load alert with "Try again" (reloads `path`) under the `<h1>` `title`
 * ("Results" live, "History" on the History detail); `focus` moves focus to
 * the `<h1>` (live only).
 */
export function ResultsLoadFailed({ path, focus, title = "Results" }: { path: string; focus: boolean; title?: string }) {
  return (
    <>
      <PageTitle id={RESULTS_HEADING_ID} tabIndex={-1}>
        {title}
      </PageTitle>
      <div className={`${CARD} w-full lg:max-w-[400px]`}>
        <p role="alert" lang="id">
          {shellMessages.firstLoadFailed}
        </p>
        <a href={path} className="font-bold text-primary underline-offset-4 hover:underline">
          Try again
        </a>
      </div>
      {focus ? <ResultsFocus targetId={RESULTS_HEADING_ID} /> : null}
    </>
  );
}

export function ResultsSkeleton() {
  return (
    <div aria-hidden="true" className="mx-auto flex w-full max-w-[880px] flex-col gap-7">
      <div className="h-[240px] w-full rounded-lg bg-muted" />
      <div className="h-[120px] w-full rounded-lg bg-muted" />
    </div>
  );
}
