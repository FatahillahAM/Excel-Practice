import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./globals.css", import.meta.url)), "utf8");
const start = css.indexOf("/* ---- Results motion");
const end = css.indexOf("/* ---- end Results motion ---- */");
const block = css.slice(start, end);

/** The body of `@keyframes name { … }` (one level of nested braces). */
function keyframes(name: string): string {
  const match = new RegExp(`@keyframes ${name} \\{((?:[^{}]*\\{[^{}]*\\})*[^{}]*)\\}`).exec(block);
  if (!match) throw new Error(`no @keyframes ${name}`);
  return match[1];
}

describe("globals.css Results motion", () => {
  it("has the Results motion block", () => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
  });

  it("uses results-lift only inside the @supports (animation-timeline: view()) braces", () => {
    const open = block.indexOf("@supports (animation-timeline: view()) {");
    expect(open).toBeGreaterThan(-1);
    // The matching closing brace of the @supports rule.
    let depth = 0;
    let close = -1;
    for (let i = block.indexOf("{", open); i < block.length; i += 1) {
      if (block[i] === "{") depth += 1;
      if (block[i] === "}" && --depth === 0) {
        close = i;
        break;
      }
    }
    expect(close).toBeGreaterThan(open);
    const uses = [...block.matchAll(/animation:\s*results-lift/g)].map((m) => m.index);
    expect(uses.length).toBeGreaterThan(0);
    for (const at of uses) {
      expect(at).toBeGreaterThan(open);
      expect(at).toBeLessThan(close);
    }
    expect(block.slice(open, close)).toMatch(/animation-range:\s*entry 0% entry 100%/);
    expect(css.replace(block, "")).not.toMatch(/results-lift/);
  });

  it("animates the fire with transform and opacity only", () => {
    for (const name of ["fire-flame", "fire-haze"]) {
      const props = [...keyframes(name).matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      expect(props.length).toBeGreaterThan(0);
      for (const prop of props) expect(["transform", "opacity"]).toContain(prop);
    }
  });

  it("plays every animation once: no iteration count other than 1", () => {
    for (const m of block.matchAll(/animation-iteration-count:\s*([^;]+);/g)) expect(m[1].trim()).toBe("1");
  });

  it("turns the count-up off in forced colours (no transparent text, no counter)", () => {
    const at = block.indexOf("@media (forced-colors: active)");
    expect(at).toBeGreaterThan(-1);
    const rule = block.slice(at, block.indexOf("/* Fire Effect", at));
    expect(rule).toMatch(/color:\s*inherit/);
    expect(rule).toMatch(/animation:\s*none/);
    expect(rule).toMatch(/content:\s*none/);
  });

  it("never animates box-shadow or filter in a Results keyframe", () => {
    for (const name of ["score-turn", "score-count", "fire-flame", "fire-haze", "results-lift"]) {
      expect(keyframes(name)).not.toMatch(/box-shadow|filter/);
    }
  });

  it("has no looping animation", () => {
    expect(block).not.toMatch(/infinite/);
  });

  it("turns the badge exactly once, to 360deg", () => {
    expect(keyframes("score-turn")).toMatch(/to\s*\{\s*transform:\s*rotateY\(360deg\);\s*\}/);
  });
});

describe("globals.css Level Map scene", () => {
  const from = css.indexOf("/* ---- Level Map scene");
  const to = css.indexOf("/* ---- end Level Map scene ---- */");
  const scene = css.slice(from, to);
  const guard = "@supports (animation-timeline: scroll()) {";

  it("has the Level Map scene block", () => {
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
  });

  it("animates only inside @supports (animation-timeline: scroll()) and prefers-reduced-motion: no-preference", () => {
    const open = scene.indexOf(guard);
    expect(open).toBeGreaterThan(-1);
    const inner = scene.slice(open);
    const media = inner.indexOf("@media (prefers-reduced-motion: no-preference) {");
    expect(media).toBeGreaterThan(-1);
    const outside = scene.slice(0, open);
    // Outside the guard: the static end frame only (no animation, no timeline).
    expect(outside).not.toMatch(/animation(-name|-timeline|-range)?\s*:/);
    const uses = [...inner.matchAll(/animation-name:\s*lm-/g)].map((m) => m.index);
    expect(uses.length).toBe(6);
    for (const at of uses) expect(at).toBeGreaterThan(media);
    expect(inner).toMatch(/animation-timeline:\s*scroll\(\)/);
    expect(css.replace(scene, "")).not.toMatch(/lm-(lap|lid|xl|board|trail|nodes)\b/);
  });

  it("the static frame is the end state: lid open, board flat, trail drawn", () => {
    expect(scene).toMatch(/\.lm-lid \{[^}]*transform: rotateX\(8deg\)/);
    expect(scene).toMatch(/\.lm-trail \{[^}]*stroke-dashoffset: 0/);
    expect(scene).not.toMatch(/\.lm-board \{[^}]*transform/);
  });

  it("keyframes move transform, opacity or the trail's dash offset only; tilt ≤25°, no Z spin", () => {
    for (const m of scene.matchAll(/@keyframes lm-[a-z]+ \{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g)) {
      for (const p of m[1].matchAll(/([a-z-]+)\s*:/g)) expect(["transform", "opacity", "stroke-dashoffset"]).toContain(p[1]);
    }
    expect(scene).not.toMatch(/rotateZ|rotate\(/);
    for (const m of scene.matchAll(/rotate[XY]\((-?\d+)deg\)/g)) {
      if (Math.abs(Number(m[1])) > 25) expect(m[0]).toBe("rotateX(-88deg)"); // the lid hinge, not a tilt
    }
  });

  it("is also stopped by the global reduced-motion rules (OS and the Settings switch)", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\*,/);
    expect(css).toContain(':root[data-motion="reduce"] *');
  });
});
