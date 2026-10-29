/**
 * `app_meta.schema_version`: the latest migration applied (supabase/migrations),
 * read through PostgREST with the publishable key; `null` when it cannot be read.
 */
export async function readSchemaVersion(base: URL, key: string): Promise<string | null> {
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
