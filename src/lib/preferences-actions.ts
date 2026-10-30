"use server";

import { cookies } from "next/headers";
import { getSessionUser } from "../adapters/supabase/auth";
import { UNAUTHENTICATED } from "../adapters/supabase/auth-rules";
import {
  isReduceMotion,
  isTheme,
  reduceMotionCookie,
  themeCookie,
  type PreferenceCookie,
} from "./preferences";

export type PreferenceResult = { ok: true } | { ok: false; code: typeof UNAUTHENTICATED | "INVALID_INPUT" };

const secure = () => process.env.NODE_ENV === "production";

async function write(cookie: PreferenceCookie): Promise<PreferenceResult> {
  if (!(await getSessionUser())) return { ok: false, code: UNAUTHENTICATED };
  (await cookies()).set(cookie.name, cookie.value, cookie.options);
  return { ok: true };
}

/** Theme Toggle (Header Bar and Settings): stores `theme` for this device. */
export async function saveTheme(value: unknown): Promise<PreferenceResult> {
  if (!isTheme(value)) return { ok: false, code: "INVALID_INPUT" };
  return write(themeCookie(value, secure()));
}

/** Settings "Reduce motion": `on` or `system` (switch off) for this device. */
export async function saveReduceMotion(value: unknown): Promise<PreferenceResult> {
  if (!isReduceMotion(value)) return { ok: false, code: "INVALID_INPUT" };
  return write(reduceMotionCookie(value, secure()));
}
