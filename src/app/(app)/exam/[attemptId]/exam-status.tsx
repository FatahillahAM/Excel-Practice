"use client";

import { useEffect, useRef, useState } from "react";
import type { AttemptStatus } from "../../../../adapters/supabase/attempts";
import { shellMessages } from "../../../../messages/id";

/** AD-11: the exam screen polls every 2 s while the attempt is in one of these. */
const POLLED: readonly AttemptStatus[] = ["open", "received", "grading_failed"];
export const POLL_MS = 2000;

/** Status answers that polling again cannot fix: no session (401) or no such attempt (404). */
export function isFinalPollFailure(httpStatus: number): boolean {
  return httpStatus === 401 || httpStatus === 404;
}

export const FINISH_HINT = "Klik Finish di file kalau sudah selesai, ya.";

/** The Exam Status Line's main text for a status (EXPERIENCE.md › Exam Status Line). */
export function statusLine(status: AttemptStatus, itemLabel: string): string {
  switch (status) {
    case "open":
      return `Excel is open — ${itemLabel}`;
    case "received":
    case "grading_failed":
    case "graded":
      return "File received — grading…";
    default:
      return "This attempt is closed.";
  }
}

/**
 * Exam Status Line (tracer): after Start (`?download=1`) navigates once to the
 * stored file, then drops the query so a reload does not download again; polls
 * `/api/attempts/<id>/status` every 2 s while the attempt is in progress; a
 * failed poll is retried on the next tick.
 */
export function ExamStatus({
  attemptId,
  itemLabel,
  initialStatus,
}: {
  attemptId: string;
  itemLabel: string;
  initialStatus: AttemptStatus;
}) {
  const [status, setStatus] = useState<AttemptStatus>(initialStatus);
  const [tick, setTick] = useState(0);
  const [lost, setLost] = useState(false);
  const downloadStarted = useRef(false);
  const downloadUrl = `/exam/${attemptId}/download`;

  useEffect(() => {
    if (downloadStarted.current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("download") !== "1") return;
    downloadStarted.current = true;
    url.searchParams.delete("download");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    // An attachment response: the browser saves it and stays on this page.
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.click();
  }, [downloadUrl]);

  useEffect(() => {
    if (lost || !POLLED.includes(status)) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/attempts/${attemptId}/status`, { cache: "no-store" });
        if (isFinalPollFailure(res.status)) {
          if (!cancelled) setLost(true);
          return;
        }
        if (!res.ok) return;
        const body = (await res.json()) as { ok?: boolean; data?: { status?: AttemptStatus } };
        const next = body.ok ? body.data?.status : undefined;
        if (!cancelled && typeof next === "string") setStatus(next);
      } catch {
        // Network error: the next tick tries again.
      } finally {
        if (!cancelled) setTick((n) => n + 1);
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // `tick` re-arms the timer after every poll, also when the status did not change.
  }, [attemptId, status, tick, lost]);

  if (lost) {
    return (
      <div className="flex flex-col gap-2">
        <p role="alert" lang="id">
          {shellMessages.firstLoadFailed}
        </p>
        <a href={`/exam/${attemptId}`} className="font-bold text-primary underline-offset-4 hover:underline">
          Try again
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div role="status" className="flex flex-col gap-1">
        <p className="font-bold">{statusLine(status, itemLabel)}</p>
        {status === "open" && <p lang="id">{FINISH_HINT}</p>}
      </div>
      {status === "open" && (
        <p className="text-xs leading-[1.4] font-medium text-muted-foreground">
          Download didn&apos;t start?{" "}
          <a href={downloadUrl} className="font-bold text-primary underline-offset-4 hover:underline">
            Download again
          </a>
        </p>
      )}
    </div>
  );
}
