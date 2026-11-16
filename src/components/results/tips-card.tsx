import { Fragment } from "react";
import { Kbd } from "@/components/ui/kbd";
import type { Tip } from "@/core/grading/result";
import { cn } from "@/lib/utils";
import { shortcutKeys } from "./outcome";

/**
 * Tips Card (DESIGN.md › Tips Card): level tag, "Soal N" with its status in
 * text (the ✓/✗ glyph is decorative), the Tip's Indonesian title and body, and
 * each shortcut as its keys in `kbd-tips`. Not a tab stop. Used by the Tips
 * Carousel on Results and, later, the Tips & Tricks collection.
 */
export function TipsCard({
  tip,
  questionNumber,
  correct,
  levelNumber,
  id,
  className,
}: {
  tip: Tip;
  questionNumber: number;
  correct: boolean;
  /** `null` when the item is not in the registry: the tag is left out. */
  levelNumber: number | null;
  id?: string;
  className?: string;
}) {
  return (
    <article id={id} data-slot="tips-card" className={cn("flex h-full flex-col gap-2 rounded-lg border border-border bg-card p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        {levelNumber === null ? (
          <span />
        ) : (
          <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] leading-[1.2] font-bold text-muted-foreground">{`Level ${levelNumber}`}</span>
        )}
        <span className={cn("text-[12px] font-bold", correct ? "text-success" : "text-destructive")}>
          <span aria-hidden="true">{correct ? "✓" : "✗"}</span> <span lang="id">{`Soal ${questionNumber}`}</span>
          {` · ${correct ? "Correct" : "Wrong"}`}
        </span>
      </div>
      <h3 lang="id" className="text-[16px] leading-[1.3] font-extrabold">
        {tip.title}
      </h3>
      <p lang="id" className="text-[14px] [overflow-wrap:anywhere]">
        {tip.body}
      </p>
      {tip.shortcuts.length > 0 ? (
        <ul aria-label="Shortcuts" className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1.5">
          {tip.shortcuts.map((shortcut) => (
            <li key={shortcut} data-shortcut={shortcut} className="flex items-center gap-1 text-[12px] text-muted-foreground">
              {shortcutKeys(shortcut).map((key, index) => (
                <Fragment key={`${index}-${key}`}>
                  {index > 0 ? "+" : null}
                  <Kbd className="px-[7px] text-[15px] leading-[1.5] font-semibold">{key}</Kbd>
                </Fragment>
              ))}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
