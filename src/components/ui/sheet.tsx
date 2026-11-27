"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/*
 * shadcn new-york Sheet on radix-ui Dialog (focus trap, `Esc`, scrim click,
 * focus back to the trigger). Motion comes from `globals.css`
 * (`.drawer-panel`, `.drawer-scrim`) instead of an animation library (AD-12);
 * `left` is the Mobile Drawer; `right` is a side sheet from the right at
 * `sm` and up and a bottom sheet on a phone (`.sheet-panel`; the Materi Sheet).
 */

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn("drawer-scrim fixed inset-0 z-50 bg-black/55", className)}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "left",
  showCloseButton = true,
  closeLabel = "Close menu",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "left" | "right";
  showCloseButton?: boolean;
  /** The close button's accessible name. */
  closeLabel?: string;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          side === "left"
            ? "drawer-panel fixed inset-y-0 left-0 z-50 flex h-full flex-col bg-card text-foreground border-r border-border"
            : "sheet-panel fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-lg border-t border-border bg-card text-foreground sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-none sm:w-[440px] sm:max-w-full sm:rounded-none sm:border-t-0 sm:border-l",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            aria-label={closeLabel}
            className="absolute top-3 right-3 grid size-11 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <XIcon aria-hidden="true" className="size-5" />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-1.5", className)} {...props} />;
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title data-slot="sheet-title" className={cn("font-semibold text-foreground", className)} {...props} />
  );
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Sheet, SheetTrigger, SheetClose, SheetPortal, SheetOverlay, SheetContent, SheetHeader, SheetTitle, SheetDescription };
