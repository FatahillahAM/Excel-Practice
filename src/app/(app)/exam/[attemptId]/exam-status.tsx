"use client";

import { useEffect, useRef, useState } from "react";
import type { AttemptStatus } from "../../../../adapters/supabase/attempts";
import { OrbitLoader } from "../../../../components/exam/orbit-loader";
import { examMessages, shellMessages } from "../../../../messages/id";
import { SLOW_GRADING_S, elapsedAt, formatElapsed, isGradingSlow, reanchor, slowGradingWaitMs } from "./exam-time";
import { UploadDropzone } from "./upload-dropzone";

/** AD-11: the exam screen polls every 2 s while the attempt is in one of these. */
const POLLED: readonly AttemptStatus[] = ["open", "received", "grading_failed"];
export const POLL_MS = 2000;
/** The elapsed time steps once a second, while the attempt is open. */
export const TICK_MS = 1000;

/** Status answers that polling again cannot fix: no session (401) or no such attempt (404). */
export function isFinalPollFailure(httpStatus: number): boolean {
  return httpStatus === 401 || httpStatus === 404;
}

/** The Exam Status Line's main text for a status (EXPERIENCE.md › Exam Status Line), without the time. */
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

/** A server value in seconds and the moment (client monotonic clock) it was taken; `at` is set after hydration. */
type Anchor = { base: number; at: number | null };

type StatusBody = { ok?: boolean; data?: { status?: AttemptStatus; elapsedSeconds?: number } };

/**
 * Orbit Loader + Exam Status Line. After Start (`?download=1`) navigates once
 * to the stored file, then drops the query so a reload does not download
 * again; polls `/api/attempts/<id>/status` every 2 s while the attempt is in
 * progress, and a failed poll is retried on the next tick.
 *
 * Time is the server's (AD-8): the page renders `initialElapsed`, the client
 * adds the seconds since its last anchor and re-anchors to `elapsedSeconds`
 * on every poll. The slow-grading message counts from `initialReceivedSeconds`
 * (server, at render) or from 0 when a poll first sees `received`.
 *
 * Live regions carry line 1, the instruction and the slow message; the time
 * sits on line 1 but outside them, so it is never announced per tick.
 *
 * While `open`, the Upload Dropzone sits under the status line (CAP-4). An
 * accepted upload moves the screen at once, as when a poll sees the change.
 */
export function ExamStatus({
  attemptId,
  itemLabel,
  initialStatus,
  initialElapsed,
  initialReceivedSeconds,
}: {
  attemptId: string;
  itemLabel: string;
  initialStatus: AttemptStatus;
  /** Seconds since Start at server render. */
  initialElapsed: number;
  /** Seconds since `received_at` at server render; `null` when not received yet. */
  initialReceivedSeconds: number | null;
}) {
  const [status, setStatus] = useState<AttemptStatus>(initialStatus);
  const [elapsed, setElapsed] = useState(initialElapsed);
  const [receivedSeconds, setReceivedSeconds] = useState(initialReceivedSeconds ?? 0);
  const [tick, setTick] = useState(0);
  const [lost, setLost] = useState(false);
  const elapsedAnchor = useRef<Anchor>({ base: initialElapsed, at: null });
  const receivedAnchor = useRef<Anchor>({ base: initialReceivedSeconds ?? 0, at: null });
  const downloadStarted = useRef(false);
  const downloadUrl = `/exam/${attemptId}/download`;

  /** The attempt's status after an accepted upload (or a duplicate), without waiting for a poll. */
  const onReceived = (next: AttemptStatus) => {
    if (next === "received" && status !== "received") {
      receivedAnchor.current = { base: 0, at: performance.now() };
      setReceivedSeconds(0);
    }
    setStatus(next);
  };

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

  // Seconds since Start: one step a second from the last anchor, only while open.
  useEffect(() => {
    if (lost || status !== "open") return;
    const anchor = elapsedAnchor.current;
    if (anchor.at === null) anchor.at = performance.now();
    const timer = window.setInterval(() => {
      const { base, at } = elapsedAnchor.current;
      const now = performance.now();
      setElapsed(elapsedAt(base, at ?? now, now));
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [status, lost]);

  // The slow-grading message once the attempt has been received for 15 s.
  useEffect(() => {
    if (lost || status !== "received" || isGradingSlow(status, receivedSeconds)) return;
    const anchor = receivedAnchor.current;
    if (anchor.at === null) anchor.at = performance.now();
    const at = anchor.at;
    const wait = slowGradingWaitMs(anchor.base, at, performance.now());
    const timer = window.setTimeout(() => {
      setReceivedSeconds(Math.max(SLOW_GRADING_S, elapsedAt(receivedAnchor.current.base, at, performance.now())));
    }, wait);
    return () => window.clearTimeout(timer);
  }, [status, receivedSeconds, lost]);

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
        const body = (await res.json()) as StatusBody;
        if (cancelled || !body.ok) return;
        const seconds = body.data?.elapsedSeconds;
        if (typeof seconds === "number" && Number.isFinite(seconds)) {
          // What is on screen now, so a 0–1 s lag from flooring never steps the time back.
          const now = performance.now();
          const { base, at } = elapsedAnchor.current;
          const shown = elapsedAt(base, at ?? now, now);
          const next = reanchor(shown, seconds);
          elapsedAnchor.current = { base: next, at: now };
          setElapsed(next);
        }
        const next = body.data?.status;
        if (typeof next === "string") {
          if (next === "received" && status !== "received") {
            // The transition seen by this poll: count from now (≤ 2 s after `received_at`).
            receivedAnchor.current = { base: 0, at: performance.now() };
            setReceivedSeconds(0);
          }
          setStatus(next);
        }
      } catch {
        // Network error: the time keeps stepping; the next tick tries again.
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
      <div className="flex flex-col items-center gap-2 text-center">
        <p role="alert" lang="id">
          {shellMessages.firstLoadFailed}
        </p>
        <a href={`/exam/${attemptId}`} className="font-bold text-primary underline-offset-4 hover:underline">
          Try again
        </a>
      </div>
    );
  }

  const open = status === "open";
  const slow = isGradingSlow(status, receivedSeconds);

  return (
    <div className="flex w-full flex-col items-center">
      {POLLED.includes(status) && <OrbitLoader />}
      <div className="mt-[18px] flex flex-col items-center text-center">
        <p className="text-[15px] font-semibold text-foreground">
          <span role="status">{statusLine(status, itemLabel)}</span>
          {open && (
            <>
              {" · "}
              <span className="font-mono font-bold tabular-nums">{formatElapsed(elapsed)}</span>
            </>
          )}
        </p>
        <div role="status" lang="id" className="text-muted-foreground">
          {open && <p className="mt-1">{examMessages.finishHint}</p>}
          {slow && <p className="mt-1">{examMessages.gradingSlow}</p>}
        </div>
        {open && (
          <p className="mt-2 text-[13px] text-muted-foreground">
            Download didn&apos;t start?{" "}
            <a href={downloadUrl} className="font-bold text-primary underline-offset-4 hover:underline">
              Download again
            </a>
          </p>
        )}
      </div>
      {open && (
        <div className="mt-[26px] w-full max-w-[400px]">
          <UploadDropzone onReceived={onReceived} onSessionLost={() => setLost(true)} />
        </div>
      )}
    </div>
  );
}
