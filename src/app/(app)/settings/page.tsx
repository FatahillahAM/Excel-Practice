import type { Metadata } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { getAccount, type Account } from "@/adapters/supabase/auth";
import { loginRedirectPath } from "@/adapters/supabase/auth-rules";
import type { TimeZoneRead } from "@/adapters/supabase/profiles";
import { surfaceTitle } from "@/components/shell/nav-items";
import { PageTitle } from "@/components/shell/page-title";
import { SettingsPreferences } from "@/components/shell/settings-preferences";
import { Separator } from "@/components/ui/separator";
import { shellMessages } from "@/messages/id";

export const metadata: Metadata = { title: surfaceTitle("Settings") };

const CARD = "flex flex-col gap-4 rounded-lg border border-border bg-card p-4";
const SECTION_LABEL = "font-mono text-[11px] leading-[1.2] font-bold tracking-[0.1em] text-muted-foreground uppercase";

/**
 * Settings (DESIGN.md › Components › Settings; EXPERIENCE.md › State
 * Patterns › Settings): Theme Toggle, Reduce motion, streak time zone
 * (read-only), "Signed in as" + Log out.
 */
export default function SettingsPage() {
  return (
    <div className="page-enter flex max-w-2xl flex-col gap-6">
      <PageTitle>Settings</PageTitle>

      <section aria-labelledby="settings-appearance" className={CARD}>
        <h2 id="settings-appearance" className={SECTION_LABEL}>
          Appearance
        </h2>
        <SettingsPreferences />
      </section>

      <Suspense fallback={<AccountSkeleton />}>
        <AccountSections />
      </Suspense>
    </div>
  );
}

async function AccountSections() {
  let account: Account | null;
  try {
    account = await getAccount();
  } catch (error) {
    // Next's own interrupts (a prefetch prerender stopped by `connection()`) are not failures.
    unstable_rethrow(error);
    console.error(JSON.stringify({ event: "settings.account_failed", name: (error as Error)?.name ?? "unknown" }));
    return <AccountView email={null} timeZone={{ ok: false }} />;
  }
  // No session (expired meanwhile): Login, then back here.
  if (!account) redirect(loginRedirectPath("/settings", ""));
  return <AccountView email={account.email ?? "El Zavier"} timeZone={account.timeZone} />;
}

function AccountView({ email, timeZone }: { email: string | null; timeZone: TimeZoneRead }) {
  return (
    <>
      <section aria-labelledby="settings-streak" className={CARD}>
        <h2 id="settings-streak" className={SECTION_LABEL}>
          Streak
        </h2>
        {timeZone.ok ? (
          <div>
            <p className="font-bold">Streak time zone</p>
            <p className={timeZone.timeZone ? "font-mono" : "text-muted-foreground"}>{timeZone.timeZone ?? "Not set"}</p>
            <p className="text-xs leading-[1.4] font-medium text-muted-foreground">Set at first login</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p role="alert" lang="id">
              {shellMessages.firstLoadFailed}
            </p>
            <a href="/settings" className="font-bold text-primary underline-offset-4 hover:underline">
              Try again
            </a>
          </div>
        )}
      </section>

      <section aria-labelledby="settings-account" className={CARD}>
        <h2 id="settings-account" className={SECTION_LABEL}>
          Account
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-4">
          {email && (
            <p className="min-w-0 break-words">
              Signed in as <span className="font-bold">{email}</span>
            </p>
          )}
          <form action="/auth/signout" method="post" className="w-full sm:ml-auto sm:w-auto">
            <button
              type="submit"
              className="inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-md border border-input-border bg-card px-[18px] font-bold text-foreground transition-colors hover:bg-muted sm:w-auto"
            >
              Log out
            </button>
          </form>
        </div>
      </section>
    </>
  );
}

function AccountSkeleton() {
  return (
    <div aria-hidden="true" className={CARD}>
      <div className="h-3 w-24 rounded-sm bg-muted" />
      <div className="h-4 w-48 rounded-sm bg-muted" />
      <Separator />
      <div className="h-11 w-full rounded-md bg-muted sm:w-28" />
    </div>
  );
}
