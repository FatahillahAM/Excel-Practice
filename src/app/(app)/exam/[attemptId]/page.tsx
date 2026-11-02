import type { Metadata } from "next";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { readAttempt, type Attempt } from "@/adapters/supabase/attempts";
import { getSessionUser } from "@/adapters/supabase/auth";
import { loginRedirectPath } from "@/adapters/supabase/auth-rules";
import { createClient } from "@/adapters/supabase/server";
import { surfaceTitle } from "@/components/shell/nav-items";
import { PageTitle } from "@/components/shell/page-title";
import { itemLabel } from "@/core/content/level-module";
import { findItem } from "@/content/levels";
import { shellMessages } from "@/messages/id";
import { ExamStatus } from "./exam-status";

export const metadata: Metadata = { title: surfaceTitle("Exam"), robots: { index: false } };

const CARD = "flex flex-col gap-4 rounded-lg border border-border bg-card p-4";

/**
 * Exam in progress (EXPERIENCE.md), tracer: the Exam Status Line for one
 * attempt, which starts the download after Start and polls the status (AD-11).
 * Entry 4 adds the elapsed time, Orbit Loader and the slow-grading message.
 */
export default function ExamPage({ params }: { params: Promise<{ attemptId: string }> }) {
  return (
    <div className="page-enter flex max-w-2xl flex-col gap-6">
      <Suspense fallback={<ExamSkeleton />}>
        <Exam params={params} />
      </Suspense>
    </div>
  );
}

async function Exam({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  const path = `/exam/${encodeURIComponent(attemptId)}`;

  const loaded = await loadAttempt(attemptId, path);
  if (loaded === "failed") return <LoadFailed path={path} />;
  if (loaded === null) notFound();
  const attempt = loaded;

  const found = findItem(attempt.itemId);
  const label = found ? itemLabel(found.item) : attempt.itemId;
  const title = found ? `Level ${found.level.number} · ${label}` : label;

  return (
    <>
      <PageTitle>{title}</PageTitle>
      <section aria-label="Exam status" className={CARD}>
        <ExamStatus attemptId={attempt.id} itemLabel={label} initialStatus={attempt.status} />
      </section>
    </>
  );
}

/** The attempt through the user's session (RLS); `null` when it is missing or not theirs. */
async function loadAttempt(attemptId: string, path: string): Promise<Attempt | null | "failed"> {
  try {
    const user = await getSessionUser();
    if (!user) redirect(loginRedirectPath(path, ""));
    const read = await readAttempt(await createClient(), attemptId);
    return read.ok ? read.value : "failed";
  } catch (error) {
    // `redirect()` and Next's prerender interrupts are not failures.
    unstable_rethrow(error);
    console.error(JSON.stringify({ event: "exam.load_failed", name: (error as Error)?.name ?? "unknown" }));
    return "failed";
  }
}

function LoadFailed({ path }: { path: string }) {
  return (
    <div className={CARD}>
      <p role="alert" lang="id">
        {shellMessages.firstLoadFailed}
      </p>
      <a href={path} className="font-bold text-primary underline-offset-4 hover:underline">
        Try again
      </a>
    </div>
  );
}

function ExamSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <div className="h-9 w-64 rounded-sm bg-muted" />
      <div className={CARD}>
        <div className="h-4 w-56 rounded-sm bg-muted" />
        <div className="h-4 w-72 rounded-sm bg-muted" />
      </div>
    </div>
  );
}
