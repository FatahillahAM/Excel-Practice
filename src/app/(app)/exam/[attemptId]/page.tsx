import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { hasValidResult, readAttempt, type Attempt } from "@/adapters/supabase/attempts";
import { getSessionUser } from "@/adapters/supabase/auth";
import { loginRedirectPath } from "@/adapters/supabase/auth-rules";
import { readHintState } from "@/adapters/supabase/hints";
import { createClient } from "@/adapters/supabase/server";
import { createServiceClient } from "@/adapters/supabase/service";
import { surfaceTitle } from "@/components/shell/nav-items";
import { itemLabel } from "@/core/content/level-module";
import { elapsedSeconds, type HintState } from "@/core/services/attempts";
import { findItem } from "@/content/levels";
import { shellMessages } from "@/messages/id";
import { ExamStatus } from "./exam-status";

export const metadata: Metadata = { title: surfaceTitle("Exam"), robots: { index: false } };

/** Statuses whose exam screen shows hints: the hint group while `open`, the revealed hints read-only after. */
const HINT_STATUSES: readonly Attempt["status"][] = ["open", "received", "grading_failed"];

const CARD = "flex flex-col gap-4 rounded-lg border border-border bg-card p-4";

/**
 * Exam in progress (EXPERIENCE.md, DESIGN.md › Layout, `key-exam.html`): one
 * centered column without a card or visible heading — Orbit Loader, Exam
 * Status Line (time since Start, from the server: AD-8), the hint group
 * (Hint Select + Hint Button) beside the Upload Dropzone and the revealed
 * hints while open (the revealed hints stay, read-only, while the file is
 * graded), Setup Guide link. The hint state (quota, soal, revealed
 * hints) comes from the server on every render (reload, Resume): read with
 * the service role after the session read proved the attempt is the user's
 * (AD-9); if that read fails, the exam works without the hint group.
 * The status is polled (AD-11). A reload renders the server's state first;
 * a graded attempt with a valid stored Result redirects to Results; one
 * without (graded by SQL before results existed) says so, with Dashboard.
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
  const { attempt, elapsed, receivedSeconds, hints } = loaded;

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
          hints={hints}
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

/** An attempt as read at render, with the server's seconds since Start and since `grading_requested_at` (else `received_at`) (AD-8). */
type LoadedAttempt = { attempt: Attempt; elapsed: number; receivedSeconds: number | null; hints: HintState | null };

/** The attempt through the user's session (RLS); `null` when it is missing or not theirs. */
async function loadAttempt(attemptId: string, path: string): Promise<LoadedAttempt | null | "failed"> {
  try {
    const user = await getSessionUser();
    if (!user) redirect(loginRedirectPath(path, ""));
    const supabase = await createClient();
    const read = await readAttempt(supabase, attemptId);
    if (!read.ok) return "failed";
    if (read.value === null) return null;
    if (read.value.status === "graded") {
      const valid = await hasValidResult(supabase, read.value.id);
      if (!valid.ok) return "failed";
      if (valid.value) redirect(`/results/${encodeURIComponent(read.value.id)}`);
    }
    const attempt = read.value;
    // In progress: the hint group while open; afterwards the revealed hints stay on screen read-only.
    const hints = HINT_STATUSES.includes(attempt.status) ? await loadHints(attempt.id) : null;
    // After the session reads: request time, so the page is dynamic.
    const now = Date.now();
    const receivedFrom = attempt.gradingRequestedAt ?? attempt.receivedAt;
    return {
      attempt,
      elapsed: elapsedSeconds(attempt.startedAt, now),
      // Since the current grading was requested (a Try again counts from 0), else since the first file.
      receivedSeconds: receivedFrom === null ? null : elapsedSeconds(receivedFrom, now),
      hints,
    };
  } catch (error) {
    // `redirect()` and Next's prerender interrupts are not failures.
    unstable_rethrow(error);
    console.error(JSON.stringify({ event: "exam.load_failed", name: (error as Error)?.name ?? "unknown" }));
    return "failed";
  }
}

/**
 * The in-progress attempt's hint state, on the service role (the snapshot
 * holds the quota and texts; AD-9), called only after the session read proved
 * the attempt is the user's. `null` when the env is missing or the read fails
 * or throws (error `exam.hint_state_failed`), or the snapshot is not a valid
 * v2 one (info `exam.hint_state_unavailable`): the page renders without hints.
 */
async function loadHints(attemptId: string): Promise<HintState | null> {
  try {
    const service = createServiceClient();
    if (service === null) {
      console.error(JSON.stringify({ event: "exam.hint_state_failed", attemptId, code: "service_env_missing" }));
      return null;
    }
    const read = await readHintState(service, attemptId);
    if (!read.ok) {
      console.error(JSON.stringify({ event: "exam.hint_state_failed", attemptId, code: "read_failed" }));
      return null;
    }
    if (read.value === null) {
      // A tracer or legacy (v1) snapshot has no hints: expected, not a fault.
      console.log(JSON.stringify({ event: "exam.hint_state_unavailable", attemptId }));
      return null;
    }
    return read.value;
  } catch (error) {
    unstable_rethrow(error);
    console.error(
      JSON.stringify({ event: "exam.hint_state_failed", attemptId, code: "threw", name: (error as Error)?.name ?? "unknown" }),
    );
    return null;
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
