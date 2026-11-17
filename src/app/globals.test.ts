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
