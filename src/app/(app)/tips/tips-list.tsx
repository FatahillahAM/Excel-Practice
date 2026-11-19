import { redirect, unstable_rethrow } from "next/navigation";
import { listResultsForTips } from "@/adapters/supabase/attempts";
import { getSessionUser } from "@/adapters/supabase/auth";
import { loginRedirectPath } from "@/adapters/supabase/auth-rules";
import { createClient } from "@/adapters/supabase/server";
import type { CollectedTip } from "@/core/progress";
import { shellMessages } from "@/messages/id";
import { toCollectedTips } from "./tips-data";
import { TipsCollectionView } from "./tips-collection-view";

const CARD = "flex flex-col gap-2 rounded-lg border border-border bg-card p-4";
const LINK = "font-bold text-primary underline-offset-4 hover:underline";

type ListState = { status: "login" } | { status: "failed" } | { status: "loaded"; tips: CollectedTip[] };

async function loadTips(): Promise<ListState> {
  try {
    const user = await getSessionUser();
    if (!user) return { status: "login" };
    const read = await listResultsForTips(await createClient(), user.id);
    if (!read.ok) return { status: "failed" };
    return { status: "loaded", tips: toCollectedTips(read.value) };
  } catch (error) {
    unstable_rethrow(error);
    // The adapter logs its own read failures; this is the page's (session, client).
    console.error(JSON.stringify({ event: "tips.load_failed", code: (error as Error)?.name ?? "unknown" }));
    return { status: "failed" };
  }
}

/** Server part of `/tips`: session, read, and the failed / empty states. */
export async function TipsList() {
  const loaded = await loadTips();
  if (loaded.status === "login") redirect(loginRedirectPath("/tips", ""));
  if (loaded.status === "failed") {
    return (
      <div className={`${CARD} w-full lg:max-w-[400px]`}>
        <p role="alert" lang="id">
          {shellMessages.firstLoadFailed}
        </p>
        {/* A full reload, as the other first-load alerts do. */}
        <a href="/tips" className={LINK}>
          Try again
        </a>
      </div>
    );
  }
  if (loaded.tips.length === 0) {
    return (
      <p data-slot="tips-empty">
        <span lang="id">{shellMessages.tipsEmpty}</span>{" "}
        <a href="/dashboard" className={LINK}>
          Go to Dashboard
        </a>
      </p>
    );
  }
  return <TipsCollectionView tips={loaded.tips} />;
}

const GRID = "grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3";

export function TipsSkeleton() {
  return (
    <div aria-hidden="true" data-slot="tips-skeleton" className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <div className="h-10 w-40 rounded-md bg-muted" />
        <div className="h-10 w-64 max-w-full rounded-md bg-muted" />
      </div>
      <div className={GRID}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-40 rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
