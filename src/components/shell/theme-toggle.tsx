"use client";

import { Moon, Sun } from "lucide-react";
import type { Theme } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import { usePreferences } from "./preferences-provider";

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

/**
 * Theme Toggle (DESIGN.md / EXPERIENCE.md): two `aria-pressed` buttons in a
 * `card` well; the selected one has a filled icon and a 2px primary ring.
 * 32px segments, 44px on phones.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = usePreferences();
  return (
    <div role="group" aria-label="Theme" className={cn("flex gap-0.5 rounded-md border border-border bg-card p-[3px]", className)}>
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "grid size-11 cursor-pointer place-items-center rounded-[9px] transition-colors sm:size-8",
              selected
                ? "bg-muted text-foreground shadow-[inset_0_0_0_2px_var(--primary)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon aria-hidden="true" className="size-[18px]" strokeWidth={1.9} fill={selected ? "currentColor" : "none"} />
          </button>
        );
      })}
    </div>
  );
}
