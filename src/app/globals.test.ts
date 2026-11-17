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

  it("uses results-lift only inside @supports (animation-timeline: view())", () => {
    const supports = block.indexOf("@supports (animation-timeline: view())");
    expect(supports).toBeGreaterThan(-1);
    const uses = [...block.matchAll(/animation:\s*results-lift/g)].map((m) => m.index);
    expect(uses.length).toBeGreaterThan(0);
    for (const at of uses) expect(at).toBeGreaterThan(supports);
    expect(css.replace(block, "")).not.toMatch(/results-lift/);
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
