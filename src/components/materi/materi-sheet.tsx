"use client";

import { BookOpen } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { MateriCard } from "@/core/content/level-module";
import { cn } from "@/lib/utils";
import { materiMessages } from "@/messages/id";
import { MateriCards } from "./materi-cards";

/**
 * The Materi Sheet (5.7): a trigger ("Materi · N kartu") that opens the
 * Practice's cards in a Sheet (from the right; a bottom sheet on a phone).
 * The same sheet on the Level Detail Panel and the Exam screen. Free to read,
 * never tracked and never gating Start. Renders nothing without cards.
 */
export function MateriSheet({
  itemLabel,
  cards,
  prominent = false,
  className,
}: {
  /** "Practice 1": the sheet's title is "Materi Practice 1". */
  itemLabel: string;
  cards: readonly MateriCard[];
  /** The next Practice's row above Start: a full-width outlined row instead of a link-style button. */
  prominent?: boolean;
  className?: string;
}) {
  if (cards.length === 0) return null;
  return (
    <Sheet>
      <SheetTrigger
        data-slot="materi-trigger"
        aria-label={`${materiMessages.row(cards.length)}, ${itemLabel}`}
        className={cn(
          "inline-flex items-center gap-1.5 font-bold text-primary underline-offset-4",
          prominent
            ? "min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-left text-[14px] transition-colors hover:bg-muted"
            : "min-h-8 text-[13px] hover:underline",
          className,
        )}
      >
        <BookOpen aria-hidden="true" className="size-4 shrink-0" />
        <span lang="id">{materiMessages.row(cards.length)}</span>
      </SheetTrigger>
      <SheetContent side="right" closeLabel="Tutup">
        <SheetHeader className="border-b border-border p-4 pr-14">
          <SheetTitle className="text-[20px] leading-[1.2] font-extrabold">
            <span lang="id">Materi</span> {itemLabel}
          </SheetTitle>
          <SheetDescription lang="id">
            {materiMessages.helper}
          </SheetDescription>
        </SheetHeader>
        <div data-slot="materi-sheet-body" className="min-h-0 flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
          <MateriCards cards={cards} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
