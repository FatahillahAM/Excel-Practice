import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/page-title";
import { surfaceTitle } from "@/components/shell/nav-items";

export const metadata: Metadata = { title: surfaceTitle("Level Map") };

/** Level Map: content lands with its own epic; the shell and title are in place. */
export default function Page() {
  return <PlaceholderPage title="Level Map" />;
}
