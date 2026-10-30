"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * shadcn new-york Switch on the brand tokens: the unchecked track uses
 * `input-border` (≥3:1, a control boundary), checked uses `primary`. The
 * track is 24px tall; a transparent pseudo-element extends the hit area to
 * 44px on phones (EXPERIENCE.md › Accessibility Floor › Targets).
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors after:absolute after:-inset-y-2.5 after:inset-x-0 after:content-[''] sm:after:hidden data-[state=checked]:bg-primary data-[state=unchecked]:bg-input-border disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 rounded-full ring-0 transition-transform duration-200 ease-[var(--ease-bouncy)] data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-foreground data-[state=unchecked]:translate-x-0.5 data-[state=unchecked]:bg-background"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
