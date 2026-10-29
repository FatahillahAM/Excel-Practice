import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Health · WORKING HARD with EXCEL",
  robots: { index: false },
};

type SupabaseCheck = { ok: boolean; detail: string; project: string; schema: string };

async function checkSupabase(): Promise<SupabaseCheck> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return { ok: false, detail: "Supabase env not set", project: "-", schema: "-" };
  }

  let base: URL;
  try {
    base = new URL(url);
  } catch {
    return { ok: false, detail: "Supabase URL is invalid", project: "-", schema: "-" };
  }

  const project = base.hostname.split(".")[0];
  try {
    const res = await fetch(new URL("/auth/v1/health", base), {
      headers: { apikey: key },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { ok: false, detail: `Auth HTTP ${res.status}`, project, schema: "-" };
  } catch {
    return { ok: false, detail: "Supabase unreachable", project, schema: "-" };
  }

  const schema = await readSchemaVersion(base, key);
  return schema === null
    ? { ok: false, detail: "Schema version unreadable", project, schema: "-" }
    : { ok: true, detail: "Auth reachable", project, schema };
}

/** `app_meta.schema_version`: the latest migration applied (supabase/migrations). */
async function readSchemaVersion(base: URL, key: string): Promise<string | null> {
  const url = new URL("/rest/v1/app_meta", base);
  url.searchParams.set("select", "value");
  url.searchParams.set("key", "eq.schema_version");
  try {
    const res = await fetch(url, {
      headers: { apikey: key },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const rows: unknown = await res.json();
    if (!Array.isArray(rows) || rows.length !== 1) return null;
    const value: unknown = rows[0]?.value;
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

async function HealthReport() {
  await connection();
  const supabase = await checkSupabase();
  const rows: [string, string][] = [
    ["Supabase", supabase.detail],
    ["Project", supabase.project],
    ["Schema", supabase.schema],
    ["Environment", process.env.VERCEL_ENV ?? "local"],
    ["Commit", process.env.VERCEL_GIT_COMMIT_SHA ?? "local"],
  ];

  return (
    <>
      <p
        data-status={supabase.ok ? "ok" : "fail"}
        className={`text-4xl font-extrabold ${supabase.ok ? "text-success" : "text-destructive"}`}
      >
        {supabase.ok ? "OK" : "FAIL"}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-mono break-all">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

export default function HealthPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <section className="w-full max-w-md flex flex-col gap-6 rounded-xl border border-border bg-card p-6">
        <h1 className="text-lg font-bold">Health</h1>
        <Suspense fallback={<p className="text-muted-foreground">Checking…</p>}>
          <HealthReport />
        </Suspense>
      </section>
    </main>
  );
}
