import type { Metadata } from "next";
import { surfaceTitle } from "@/components/shell/nav-items";
import { PageTitle } from "@/components/shell/page-title";
import { itemLabel } from "@/core/content/level-module";
import { levels } from "@/content/levels";
import { StartControl } from "./start-control";

export const metadata: Metadata = { title: surfaceTitle("Level Map") };

const CARD = "flex flex-col gap-4 rounded-lg border border-border bg-card p-4";
const SECTION_LABEL = "font-mono text-[11px] leading-[1.2] font-bold tracking-[0.1em] text-muted-foreground uppercase";

/**
 * Level Map, tracer: one Start control per item of the V1 levels in the
 * registry (today Level 1 · Practice 1). Entry 6 turns this into the Level
 * Detail Panel; epic 4 adds the Level Map around it.
 */
export default function Page() {
  const items = levels
    .filter((level) => level.phase === "v1")
    .flatMap((level) => level.items.map((item) => ({ level, item })));
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageTitle>Level Map</PageTitle>
      {items.map(({ level, item }) => {
        const label = itemLabel(item);
        return (
          <section key={item.id} aria-labelledby={`item-${item.id}`} className={CARD}>
            <div className="flex flex-col gap-1">
              <h2 id={`item-${item.id}`} className={SECTION_LABEL}>
                Level {level.number} · {label}
              </h2>
              <p lang="id" className="font-bold">
                {level.name}
              </p>
            </div>
            <StartControl itemId={item.id} label={label} />
          </section>
        );
      })}
    </div>
  );
}
