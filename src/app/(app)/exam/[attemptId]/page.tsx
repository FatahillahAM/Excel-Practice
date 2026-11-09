import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { readAttempt, type Attempt } from "@/adapters/supabase/attempts";
import { getSessionUser } from "@/adapters/supabase/auth";
import { loginRedirectPath } from "@/adapters/supabase/auth-rules";
import { createClient } from "@/adapters/supabase/server";
import { surfaceTitle } from "@/components/shell/nav-items";
import { itemLabel } from "@/core/content/level-module";
import { elapsedSeconds } from "@/core/services/attempts";
import { findItem } from "@/content/levels";
import { shellMessages } from "@/messages/id";
import { ExamStatus } from "./exam-status";

export const metadata: Metadata = { title: surfaceTitle("Exam"), robots: { index: false } };

const CARD = "flex flex-col gap-4 rounded-lg border border-border bg-card p-4";

/**
 * Exam in progress (EXPERIENCE.md, DESIGN.md › Layout, `key-exam.html`): one
 * centered column without a card or visible heading — Orbit Loader, Exam
 * Status Line (time since Start, from the server: AD-8), Upload Dropzone
 * while open, Setup Guide link.
 * The status is polled (AD-11). A reload renders the server's state first.
 */
export default function ExamPage({ params }: { params: Promise<{ attemptId: string }> }) {
  return (
    <div className="page-enter mx-auto flex w-full max-w-[600px] flex-col items-center">
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
  const { attempt, elapsed, receivedSeconds } = loaded;

  const found = findItem(attempt.itemId);
  const label = found ? itemLabel(found.item) : attempt.itemId;
  const title = found ? `Level ${found.level.number} · ${label}` : label;

  return (
    <>
      {/* No visible heading: the Orbit is the focus (key-exam.html). */}
      <h1 className="sr-only">{`${title}, in progress`}</h1>
      <section aria-label="Exam status" className="flex w-full flex-col items-center">
        <ExamStatus
          attemptId={attempt.id}
          itemLabel={label}
          initialStatus={attempt.status}
          initialElapsed={elapsed}
          initialReceivedSeconds={receivedSeconds}
        />
      </section>
      <p className="mt-[22px] flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <BookOpen aria-hidden="true" className="size-3.5" />
        Finish not working?{" "}
        <Link href="/setup-guide" className="font-bold text-primary underline-offset-4 hover:underline">
          Setup Guide
        </Link>
      </p>
    </>
  );
}

/** An attempt as read at render, with the server's seconds since Start and since `received_at` (AD-8). */
type LoadedAttempt = { attempt: Attempt; elapsed: number; receivedSeconds: number | null };

/** The attempt through the user's session (RLS); `null` when it is missing or not theirs. */
async function loadAttempt(attemptId: string, path: string): Promise<LoadedAttempt | null | "failed"> {
  try {
    const user = await getSessionUser();
    if (!user) redirect(loginRedirectPath(path, ""));
    const read = await readAttempt(await createClient(), attemptId);
    if (!read.ok) return "failed";
    if (read.value === null) return null;
    // After the session read: request time, so the page is dynamic.
    const now = Date.now();
    const attempt = read.value;
    return {
      attempt,
      elapsed: elapsedSeconds(attempt.startedAt, now),
      receivedSeconds: attempt.receivedAt === null ? null : elapsedSeconds(attempt.receivedAt, now),
    };
  } catch (error) {
    // `redirect()` and Next's prerender interrupts are not failures.
    unstable_rethrow(error);
    console.error(JSON.stringify({ event: "exam.load_failed", name: (error as Error)?.name ?? "unknown" }));
    return "failed";
  }
}

function LoadFailed({ path }: { path: string }) {
  return (
    <div className={`${CARD} w-full`}>
      <p role="alert" lang="id">
        {shellMessages.firstLoadFailed}
      </p>
      <a href={path} className="font-bold text-primary underline-offset-4 hover:underline">
        Try again
      </a>
    </div>
  );
}

/** The loaded layout's shape: the Orbit's square, then the status line's two text lines; no card. */
function ExamSkeleton() {
  return (
    <div aria-hidden="true" className="flex w-full flex-col items-center">
      <div className="aspect-square w-full max-w-[320px] rounded-lg bg-muted" />
      <div className="mt-[18px] flex flex-col items-center gap-2">
        <div className="h-4 w-56 rounded-sm bg-muted" />
        <div className="h-4 w-72 rounded-sm bg-muted" />
      </div>
    </div>
  );
}
