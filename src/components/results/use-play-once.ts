"use client";

import { useLayoutEffect, useState } from "react";
import { resolveMotionPreference, useMotionPreference, type MotionOptions } from "@/hooks/use-motion-preference";

type NavigatorHints = Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };

/** The motion preference as it is right now in the browser (not the hydration value). */
function liveFull(options: MotionOptions): boolean {
  const nav = navigator as NavigatorHints;
  return (
    resolveMotionPreference(
      {
        osReduce: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        switchOn: document.documentElement.dataset.motion === "reduce",
        saveData: nav.connection?.saveData,
        deviceMemory: nav.deviceMemory,
      },
      options,
    ) === "full"
  );
}

/**
 * Results motion plays once per mount (3.7): it is armed only when motion is
 * full at mount (before paint), and once reduced motion turns it off it never
 * comes back, so turning the switch off again does not replay it. `false` on
 * the server and during hydration.
 */
export function usePlayOnce(allowed: boolean, options: MotionOptions = {}): boolean {
  const scene = options.scene === true;
  const preference = useMotionPreference({ scene });
  const [latch, setLatch] = useState<"pending" | "on" | "off">("pending");

  useLayoutEffect(() => {
    // Decided once, at mount, from the live signals.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLatch(allowed && liveFull({ scene }) ? "on" : "off");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (latch === "on" && preference === "reduce" && !liveFull({ scene })) setLatch("off");
  }, [latch, preference, scene]);

  return latch === "on" && preference === "full";
}
