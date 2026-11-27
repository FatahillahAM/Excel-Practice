import { Fragment } from "react";
import { shortcutKeys } from "@/components/results/outcome";
import { Kbd } from "@/components/ui/kbd";
import { materiSegments, type MateriCard } from "@/core/content/level-module";

const CODE = "rounded-[4px] bg-muted px-1 py-px font-mono text-[0.9em] [overflow-wrap:anywhere]";

/** A shortcut as its keys (`Ctrl+Shift+%` → Ctrl + Shift + %), as the Tips Card shows them. */
function Keys({ shortcut, className }: { shortcut: string; className?: string }) {
  return (
    <>
      {shortcutKeys(shortcut).map((key, index) => (
        <Fragment key={`${index}-${key}`}>
          {index > 0 ? "+" : null}
          <Kbd className={className}>{key}</Kbd>
        </Fragment>
      ))}
    </>
  );
}

/** Materi text with its inline markup: `` `…` `` as `<code lang="en">`, `[[…]]` as `<kbd>` keys. */
export function MateriText({ text }: { text: string }) {
  return (
    <>
      {materiSegments(text).map((segment, i) =>
        segment.kind === "text" ? (
          <Fragment key={i}>{segment.value}</Fragment>
        ) : segment.kind === "code" ? (
          <code key={i} lang="en" className={CODE}>
            {segment.value}
          </code>
        ) : (
          <Keys key={i} shortcut={segment.value} />
        ),
      )}
    </>
  );
}

/**
 * The Materi cards of a Practice (5.7), in the Tips Card style (DESIGN.md ›
 * Tips Card): title, concept, an example formula with its note, the click
 * steps and the shortcuts. Indonesian (`lang="id"`); formulas, cells and
 * menus are `<code lang="en">`, keys `<kbd lang="en">`. Not a tab stop.
 */
export function MateriCards({ cards }: { cards: readonly MateriCard[] }) {
  return (
    <ol data-slot="materi-cards" className="flex flex-col gap-3">
      {cards.map((card, index) => (
        <li key={card.id}>
          <article data-slot="materi-card" lang="id" aria-labelledby={`materi-${card.id}`} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
            <h3 id={`materi-${card.id}`} className="text-[16px] leading-[1.3] font-extrabold">
              <span className="mr-1.5 font-mono text-[12px] font-bold text-muted-foreground">{index + 1}.</span>
              <MateriText text={card.title} />
            </h3>
            <p className="text-[14px] [overflow-wrap:anywhere]">
              <MateriText text={card.concept} />
            </p>
            <p data-slot="materi-example" className="flex flex-col gap-1 rounded-md bg-muted/60 p-2.5 text-[13px]">
              <span className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">Contoh</span>
              <code lang="en" className="font-mono text-[14px] font-semibold [overflow-wrap:anywhere]">
                {card.example.formula}
              </code>
              <span className="text-muted-foreground">
                <MateriText text={card.example.note} />
              </span>
            </p>
            <ol aria-label="Langkah" className="ml-5 list-decimal space-y-1 text-[14px] [overflow-wrap:anywhere]">
              {card.steps.map((step, i) => (
                <li key={i}>
                  <MateriText text={step} />
                </li>
              ))}
            </ol>
            {card.shortcuts.length > 0 ? (
              <ul aria-label="Shortcuts" lang="en" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
                {card.shortcuts.map((shortcut, i) => (
                  <li key={`${i}-${shortcut}`} data-shortcut={shortcut} className="flex items-center gap-1 text-[12px] text-muted-foreground">
                    <Keys shortcut={shortcut} className="px-[7px] text-[15px] leading-[1.5] font-semibold" />
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        </li>
      ))}
    </ol>
  );
}
