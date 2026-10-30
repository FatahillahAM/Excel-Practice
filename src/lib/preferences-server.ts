import { cookies } from "next/headers";
import { parsePreferences, type Preferences } from "./preferences";

/** This request's Theme and Reduce motion cookies (server only). */
export async function readPreferences(): Promise<Preferences> {
  const store = await cookies();
  return parsePreferences((name) => store.get(name)?.value);
}
