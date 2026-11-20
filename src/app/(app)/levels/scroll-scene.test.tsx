import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FIXTURE_LEVELS } from "@/core/content/__fixtures__/levels";
import { levelProgress } from "@/core/progress";
import { ScrollScene } from "./scroll-scene";

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const css = read("../../globals.css");
const progress = levelProgress([], FIXTURE_LEVELS);

describe("ScrollScene", () => {
  it("replays every visit: two consecutive renders give the same full scene (nothing remembered)", () => {
    const first = renderToStaticMarkup(<ScrollScene progress={progress} />);
    const second = renderToStaticMarkup(<ScrollScene progress={progress} />);
    expect(first).toContain('data-scene="level-map"');
    expect(second).toBe(first);
  });

  it("the scene and the map client use no localStorage, sessionStorage or cookies", () => {
    for (const file of ["./scroll-scene.tsx", "./level-map-client.tsx"]) {
      expect(read(file)).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    }
  });

  it("every rendered data-scene / data-lm value has a matching selector in globals.css", () => {
    const markup = renderToStaticMarkup(<ScrollScene progress={progress} />);
    const scenes = [...markup.matchAll(/data-scene="([^"]+)"/g)].map((m) => m[1]);
    const parts = [...new Set([...markup.matchAll(/data-lm="([^"]+)"/g)].map((m) => m[1]))];
    expect(scenes).toEqual(["level-map"]);
    expect(parts.sort()).toEqual(["board", "laptop", "lid", "nodes", "trail", "xl"]);
    for (const scene of scenes) expect(css).toContain(`[data-scene="${scene}"]`);
    for (const part of parts) expect(css).toContain(`[data-scene="level-map"] [data-lm="${part}"]`);
    for (const cls of new Set([...markup.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(" ")))) {
      expect(css).toContain(`.${cls} {`);
    }
  });
});
