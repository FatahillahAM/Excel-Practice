import type { Metadata } from "next";
import Link from "next/link";
import { surfaceTitle } from "@/components/shell/nav-items";
import { PageTitle } from "@/components/shell/page-title";
import { attemptCardView, loadOpenAttempt } from "../open-attempt";
import { SetupStepsList } from "./setup-steps-list";
import { SETUP_STEPS, STILL_BLOCKED } from "./setup-steps";

export const metadata: Metadata = { title: surfaceTitle("Setup Guide") };

/**
 * Setup Guide (CAP-16, EXPERIENCE.md › Setup Steps): the one-time Excel 2021
 * steps, then the upload pointer, with "Resume" to the exam screen while an
 * attempt is in progress — read on the server by the same `loadOpenAttempt`
 * as the Dashboard and /levels. A failed read (already logged) shows the
 * guide without "Resume" and without an error: the guide is the point.
 */
export default async function SetupGuidePage() {
  const loaded = await loadOpenAttempt();
  const resumeHref =
    loaded !== null && loaded !== "failed" ? attemptCardView(loaded.attempt, loaded.elapsed).resumeHref : null;
  return (
    <div className="page-enter flex max-w-[720px] flex-col gap-6">
      <PageTitle>Setup Guide</PageTitle>
      <SetupStepsList steps={SETUP_STEPS} />
      <p className="text-muted-foreground">
        {STILL_BLOCKED}
        {resumeHref !== null && (
          <>
            {" "}
            <Link href={resumeHref} className="font-bold text-primary underline-offset-4 hover:underline">
              Resume
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
