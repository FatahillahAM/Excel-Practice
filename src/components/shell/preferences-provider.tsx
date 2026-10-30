"use client";

import { createContext, startTransition, useContext, useRef, useState } from "react";
import type { Preferences, ReduceMotion, Theme } from "@/lib/preferences";
import { saveReduceMotion, saveTheme, type PreferenceResult } from "@/lib/preferences-actions";

export type SaveState = "idle" | "saving" | "saved" | "error";

type PreferencesContextValue = {
  theme: Theme;
  reduceMotion: ReduceMotion;
  saveState: SaveState;
  setTheme: (theme: Theme) => void;
  setReduceMotion: (on: boolean) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/**
 * One source for the Header Bar Theme Toggle and Settings, so both always
 * show the same value. A change applies instantly on <html> and is then
 * stored in the device cookie by a Server Action; the next server render
 * reads the same value before first paint (no inline script).
 */
export function PreferencesProvider({ initial, children }: { initial: Preferences; children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initial.theme);
  const [reduceMotion, setReduceMotionState] = useState<ReduceMotion>(initial.reduceMotion);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const latest = useRef(0);

  function persist(save: () => Promise<PreferenceResult>) {
    const ticket = ++latest.current;
    setSaveState("saving");
    startTransition(async () => {
      let ok = false;
      try {
        ok = (await save()).ok;
      } catch {
        ok = false;
      }
      // Only the last change reports, so a slow earlier save cannot overwrite it.
      if (ticket === latest.current) setSaveState(ok ? "saved" : "error");
    });
  }

  function setTheme(next: Theme) {
    if (next === theme) return;
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    persist(() => saveTheme(next));
  }

  function setReduceMotion(on: boolean) {
    const next: ReduceMotion = on ? "on" : "system";
    if (next === reduceMotion) return;
    setReduceMotionState(next);
    // `system` writes no attribute: the OS media query decides alone.
    if (on) document.documentElement.dataset.motion = "reduce";
    else delete document.documentElement.dataset.motion;
    persist(() => saveReduceMotion(next));
  }

  return (
    <PreferencesContext value={{ theme, reduceMotion, saveState, setTheme, setReduceMotion }}>
      {children}
    </PreferencesContext>
  );
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside <PreferencesProvider>");
  return value;
}
