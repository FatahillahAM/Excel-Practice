import { describe, expect, it } from "vitest";
import { resolveMotionPreference } from "./use-motion-preference";

const none = { osReduce: false, switchOn: false };

describe("resolveMotionPreference", () => {
  it("is full motion by default", () => {
    expect(resolveMotionPreference(none)).toBe("full");
  });

  it("reduces when the OS asks", () => {
    expect(resolveMotionPreference({ ...none, osReduce: true })).toBe("reduce");
  });

  it("reduces when the Settings switch is on, even if the OS does not ask", () => {
    expect(resolveMotionPreference({ ...none, switchOn: true })).toBe("reduce");
  });

  it("ignores Save-Data and device memory outside scenes", () => {
    expect(resolveMotionPreference({ ...none, saveData: true, deviceMemory: 2 })).toBe("full");
  });

  it("makes scenes static on Save-Data", () => {
    expect(resolveMotionPreference({ ...none, saveData: true }, { scene: true })).toBe("reduce");
  });

  it.each([
    [0.5, "reduce"],
    [4, "reduce"],
    [8, "full"],
  ] as const)("scene with deviceMemory %s → %s", (deviceMemory, expected) => {
    expect(resolveMotionPreference({ ...none, deviceMemory }, { scene: true })).toBe(expected);
  });

  it("keeps scenes full when the browser reports no hints", () => {
    expect(resolveMotionPreference(none, { scene: true })).toBe("full");
  });

  it("still reduces scenes on the OS flag with plenty of memory", () => {
    expect(resolveMotionPreference({ ...none, osReduce: true, deviceMemory: 16 }, { scene: true })).toBe("reduce");
  });
});
