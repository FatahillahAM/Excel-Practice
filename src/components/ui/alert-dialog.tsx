"use client";

import * as React from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";

import { cn } from "../../lib/utils";

/*
 * shadcn new-york AlertDialog on radix-ui (role `alertdialog`, focus trap,
 * `Esc` closes, no scrim-click dismiss, focus back to the trigger) for the
 * confirmation of a destructive action. Motion comes from `globals.css`
 * (`.dialog-panel`, `.dialog-scrim`) instead of an animation library
 * (AD-12), as `sheet.tsx` does.
 */

const BUTTON =
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md px-[18px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Button looks of the dialog's actions: outline (Cancel) and destructive.
 * Destructive is `destructive` text and border on `destructive-soft` (the
 * pairing DESIGN.md uses for rejected and failed states), readable in both
 * themes. The destructive action is the caller's own button (usually a form
 * submit that keeps the dialog open while pending), not radix `Action`,
 * which closes the dialog on click.
 */
export const alertDialogButton = {
  outline: cn(BUTTON, "border border-input-border bg-card text-foreground hover:bg-muted"),
  destructive: cn(BUTTON, "border-[1.5px] border-destructive bg-destructive-soft text-destructive hover:bg-destructive-soft/80"),
} as const;

function AlertDialog({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />;
}

function AlertDialogPortal({ ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />;
}

function AlertDialogOverlay({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn("dialog-scrim fixed inset-0 z-50 bg-black/55", className)}
      {...props}
    />
  );
}

function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "dialog-panel fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-32px)] max-w-[440px] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-lg border border-border bg-card p-5 text-foreground shadow-lg",
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />;
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("text-lg leading-[1.2] font-extrabold", className)}
      {...props}
    />
  );
}

function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

function AlertDialogCancel({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      data-slot="alert-dialog-cancel"
      className={cn(alertDialogButton.outline, className)}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
};
