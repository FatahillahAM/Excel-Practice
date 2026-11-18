import { redirect, unstable_rethrow } from "next/navigation";
import { listGradedResults } from "@/adapters/supabase/attempts";
import { getSessionUser } from "@/adapters/supabase/auth";
import { loginRedirectPath } from "@/adapters/supabase/auth-rules";
import { createClient } from "@/adapters/supabase/server";
import { shellMessages } from "@/messages/id";
import { toHistoryRows, type HistoryRow } from "./history-rows";

const CARD = "flex flex-col gap-2 rounded-lg border border-border bg-card p-4";
const LINK = "font-bold text-primary underline-offset-4 hover:underline";

type ListState = { status: "login" } | { status: "failed" } | { status: "loaded"; rows: HistoryRow[] };

async function loadHistory(): Promise<ListState> {
  try {
    const user = await getSessionUser();
    if (!user) return { status: "login" };
    const read = await listGradedResults(await createClient(), user.id);
    if (!read.ok) return { status: "failed" };
    return { status: "loaded", rows: toHistoryRows(read.value) };
  } catch (error) {
    unstable_rethrow(error);
    // The adapter logs its own read failures; this is the page's (session, client).
    console.error(JSON.stringify({ event: "history.load_failed", code: (error as Error)?.name ?? "unknown" }));
    return { status: "failed" };
  }
}

export async function HistoryList() {
  const loaded = await loadHistory();
  if (loaded.status === "login") redirect(loginRedirectPath("/history", ""));
  if (loaded.status === "failed") {
    return (
      <div className={`${CARD} w-full lg:max-w-[400px]`}>
        <p role="alert" lang="id">
          {shellMessages.firstLoadFailed}
        </p>
        {/* A full reload, as the other first-load alerts do. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/history" className={LINK}>
          Try again
        </a>
      </div>
    );
  }
  if (loaded.rows.length === 0) {
    return (
      <p data-slot="history-empty">
        <span lang="id">{shellMessages.historyEmpty}</span>{" "}
        <a href="/dashboard" className={LINK}>
          Go to Dashboard
        </a>
      </p>
    );
  }
  return (
    <ul data-slot="history-list" className="flex w-full flex-col overflow-hidden rounded-lg border border-border bg-card lg:max-w-[720px]">
      {loaded.rows.map((row) => (
        <li key={row.id} className="border-b border-border last:border-b-0">
          <a
            href={row.href}
            aria-label={row.accessibleName}
            data-slot="history-row"
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-muted focus-visible:bg-muted"
          >
            <span data-slot="history-label" className="min-w-0 flex-1 font-bold">
              {row.label}
            </span>
            <span data-slot="history-date" className="text-[12px] text-muted-foreground">
              {row.date}
            </span>
            <span data-slot="history-score" className="font-bold tabular-nums">
              {row.score}
            </span>
            <span data-slot="history-time" className="text-[12px] text-muted-foreground">
              <span className="tabular-nums">{row.time}</span> time
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function HistorySkeleton() {
  return (
    <div aria-hidden="true" data-slot="history-skeleton" className="flex w-full flex-col gap-2 lg:max-w-[720px]">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-12 w-full rounded-lg bg-muted" />
      ))}
    </div>
  );
}
