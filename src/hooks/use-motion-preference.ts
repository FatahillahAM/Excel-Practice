"use client";

import { useSyncExternalStore } from "react";

/**
 * The one motion switch for code that decides about motion in JS (AD-12):
 * `prefers-reduced-motion`, the Settings "Reduce motion" switch (written as
 * `data-motion="reduce"` on <html>) and, for 3D Scroll Scenes, Save-Data and
 * low device memory. CSS-only motion already follows the first two through
 * `globals.css`.
 */
export type MotionPreference = "full" | "reduce";

export type MotionSignals = {
  /** `(prefers-reduced-motion: reduce)` matches. */
  osReduce: boolean;
  /** Settings switch on (`data-motion="reduce"`). */
  switchOn: boolean;
  /** `navigator.connection.saveData`. */
  saveData?: boolean;
  /** `navigator.deviceMemory` in GiB, when the browser reports it. */
  deviceMemory?: number;
};

export type MotionOptions = {
  /** A 3D Scroll Scene: also static on Save-Data and `deviceMemory ≤ 4`. */
  scene?: boolean;
};

/** Pure combination of the signals (unit-tested). */
export function resolveMotionPreference(signals: MotionSignals, options: MotionOptions = {}): MotionPreference {
  if (signals.osReduce || signals.switchOn) return "reduce";
  if (options.scene) {
    if (signals.saveData === true) return "reduce";
    if (typeof signals.deviceMemory === "number" && signals.deviceMemory <= 4) return "reduce";
  }
  return "full";
}

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

type NavigatorHints = Navigator & {
  connection?: { saveData?: boolean } & Partial<Pick<EventTarget, "addEventListener" | "removeEventListener">>;
  deviceMemory?: number;
};

function readSignals(): MotionSignals {
  const nav = navigator as NavigatorHints;
  return {
    osReduce: window.matchMedia(REDUCE_QUERY).matches,
    switchOn: document.documentElement.dataset.motion === "reduce",
    saveData: nav.connection?.saveData,
    deviceMemory: nav.deviceMemory,
  };
}

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCE_QUERY);
  query.addEventListener("change", onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  // Save-Data can flip while the page is open (Network Information API, Chromium only).
  const connection = (navigator as NavigatorHints).connection;
  connection?.addEventListener?.("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
    observer.disconnect();
    connection?.removeEventListener?.("change", onChange);
  };
}

/**
 * `"reduce"` during server render and hydration (static frame first), then
 * the live value; re-renders when the OS setting or the switch changes.
 */
export function useMotionPreference(options: MotionOptions = {}): MotionPreference {
  const scene = options.scene === true;
  return useSyncExternalStore(
    subscribe,
    () => resolveMotionPreference(readSignals(), { scene }),
    () => "reduce",
  );
}
