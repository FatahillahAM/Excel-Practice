import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginCard, SignInBlock } from "./login-card";

export const metadata: Metadata = {
  title: "Sign in · WORKING HARD with EXCEL",
  robots: { index: false },
};

/**
 * Login (CAP-17; DESIGN.md › Login Card). A signed-in visitor never sees it:
 * the proxy redirects `/login` with a session to `next` or `/`.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="login-enter-column flex w-full max-w-md flex-col items-center gap-8">
        <div
          aria-hidden="true"
          className="grid size-8 place-items-center rounded-[9px] bg-primary text-primary-foreground shadow-[0_6px_18px_-4px_var(--glow-strong)]"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-[18px]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="M3 9h18M3 15h18M9 3v18" />
          </svg>
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-[32px] font-[850] leading-[1.1] tracking-[-0.025em]">
            WORKING HARD <span className="text-primary">with EXCEL</span>
          </h1>
          <p className="text-sm text-muted-foreground">Sign in to continue your practice.</p>
        </div>

        <div className="login-enter-block w-full">
          <Suspense fallback={<SignInBlock />}>
            <LoginCard />
          </Suspense>
        </div>

        <div className="w-full border-t border-border" />
      </div>
    </main>
  );
}
