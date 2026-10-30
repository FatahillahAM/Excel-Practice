import { redirect } from "next/navigation";

/**
 * `/` opens Dashboard. `next.config.ts` answers `/` with a 307 first; this
 * page is the fallback should a request ever reach it.
 */
export default function Home() {
  redirect("/dashboard");
}
