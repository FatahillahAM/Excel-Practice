import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/shell/page-title";
import { surfaceTitle } from "@/components/shell/nav-items";

export const metadata: Metadata = { title: surfaceTitle("Records") };

/** Records: content lands with its own epic; the shell and title are in place. */
export default function Page() {
  return <PlaceholderPage title="Records" enter />;
}
