import type { Metadata } from "next";
import { htmlPreferenceAttributes } from "@/lib/preferences";
import { readPreferences } from "@/lib/preferences-server";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "WORKING HARD with EXCEL",
  description: "Personal Excel practice: levels, exams in Excel, and streaks.",
};

/*
 * `data-theme` / `data-motion` come from the per-device cookies so the first
 * paint already has the right theme (Consistency Conventions › Preferences).
 * Reading cookies here makes every route request-bound and there is no child
 * to wrap in <Suspense>, so the root opts into a blocking render.
 */
export const instant = false;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const preferences = await readPreferences();
  return (
    <html lang="en" {...htmlPreferenceAttributes(preferences)}>
      <body>{children}</body>
    </html>
  );
}
