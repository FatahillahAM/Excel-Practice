"use client";

import { createContext, startTransition, useContext, useRef, useState } from "react";
import { UNAUTHENTICATED, loginRedirectPath } from "@/adapters/supabase/auth-rules";
import {
  INITIAL_SAVE,
  applyPreferenceAttributes,
  finishSave,
  startSave,
  type Preferences,
  type ReduceMotion,
  type SaveState,
  type SaveTracker,
  type Theme,
} from "@/lib/preferences";
import { saveReduceMotion, saveTheme, type PreferenceResult } from "@/lib/preferences-actions";

export type { SaveState };

type PreferencesContextValue = {
  theme: Theme;
  reduceMotion: ReduceMotion;
  saveState: SaveState;
  setTheme: (theme: Theme) => void;
  setReduceMotion: (on: boolean) => void;
};

type Key = keyof Preferences;

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/**
 * One source for the Header Bar Theme Toggle and Settings, so both always
 * show the same value. A change applies instantly on <html> and is then
 * stored in the device cookie by a Server Action; the next server render
 * reads the same value before first paint (no inline script). A failed save
 * puts the last stored value back; a lost session goes to Login.
 */
export function PreferencesProvider({ initial, children }: { initial: Preferences; children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(initial);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  /** What <html> shows now (read by async callbacks). */
  const current = useRef<Preferences>(initial);
  /** What the cookie holds: the value a failed save reverts to. */
  const stored = useRef<Preferences>(initial);
  const status = useRef<SaveTracker>(INITIAL_SAVE);
  const perKey = useRef<Record<Key, SaveTracker>>({ theme: INITIAL_SAVE, reduceMotion: INITIAL_SAVE });

  function show(next: Preferences) {
    current.current = next;
    applyPreferenceAttributes(document.documentElement.dataset, next);
    setPreferences(next);
  }

  function change<K extends Key>(key: K, value: Preferences[K], save: () => Promise<PreferenceResult>) {
    if (current.current[key] === value) return;
    show({ ...current.current, [key]: value });

    const started = startSave(status.current);
    status.current = started.tracker;
    const keyStarted = startSave(perKey.current[key]);
    perKey.current[key] = keyStarted.tracker;
    setSaveState(started.tracker.state);

    startTransition(async () => {
      let result: PreferenceResult | null = null;
      try {
        result = await save();
      } catch {
        result = null;
      }
      if (result && !result.ok && result.code === UNAUTHENTICATED) {
        window.location.assign(loginRedirectPath(window.location.pathname, window.location.search));
        return;
      }
      const outcome = result?.ok ? "saved" : "error";

      // Only the latest change of this preference may keep or revert it.
      const keyAfter = finishSave(perKey.current[key], keyStarted.ticket, outcome);
      if (keyAfter !== perKey.current[key]) {
        perKey.current[key] = keyAfter;
        if (outcome === "saved") stored.current = { ...stored.current, [key]: value };
        else show({ ...current.current, [key]: stored.current[key] });
      }

      // Only the latest change of any preference reports.
      const statusAfter = finishSave(status.current, started.ticket, outcome);
      if (statusAfter !== status.current) {
        status.current = statusAfter;
        setSaveState(statusAfter.state);
      }
    });
  }

  const value: PreferencesContextValue = {
    theme: preferences.theme,
    reduceMotion: preferences.reduceMotion,
    saveState,
    setTheme: (theme) => change("theme", theme, () => saveTheme(theme)),
    // `system` (switch off) writes no attribute: the OS media query decides alone.
    setReduceMotion: (on) => {
      const next: ReduceMotion = on ? "on" : "system";
      change("reduceMotion", next, () => saveReduceMotion(next));
    },
  };

  return <PreferencesContext value={value}>{children}</PreferencesContext>;
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used inside <PreferencesProvider>");
  return value;
}
