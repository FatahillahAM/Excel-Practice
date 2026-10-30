"use client";

import { Switch } from "@/components/ui/switch";
import { shellMessages } from "@/messages/id";
import { usePreferences } from "./preferences-provider";
import { ThemeToggle } from "./theme-toggle";

/** Settings › Appearance: Theme Toggle + Reduce motion switch, saved per device. */
export function SettingsPreferences() {
  const { reduceMotion, setReduceMotion, saveState } = usePreferences();
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <p aria-hidden="true" className="font-bold">
          Theme
        </p>
        <ThemeToggle />
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <label htmlFor="settings-reduce-motion" className="font-bold">
            Reduce motion
          </label>
          <p id="settings-reduce-motion-hint" className="text-xs leading-[1.4] font-medium text-muted-foreground">
            Motion also stays off whenever your device asks for less motion.
          </p>
        </div>
        <Switch
          id="settings-reduce-motion"
          checked={reduceMotion === "on"}
          onCheckedChange={setReduceMotion}
          aria-describedby="settings-reduce-motion-hint"
        />
      </div>
      <p role="status" className="min-h-5 text-xs leading-[1.4] font-medium">
        {saveState === "saved" && <span className="text-muted-foreground">Saved on this device.</span>}
        {saveState === "error" && (
          <span lang="id" className="text-destructive">
            {shellMessages.preferenceSaveFailed}
          </span>
        )}
      </p>
    </>
  );
}
