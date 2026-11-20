import { CURRICULUM, type LevelProgress } from "@/core/progress";
import { cn } from "@/lib/utils";

/**
 * The Level Map's 3D Scroll Scene (D3, AD-12; `key-level-map.html`): a
 * decorative copy of the map (`aria-hidden`, `inert`) — a laptop opening, the
 * Excel mark turning, the board laying flat, the trail drawing and the nodes
 * lighting up to the active level. CSS only (`globals.css` › Level Map
 * scene): a ~2.6 s timed intro on every visit, only under
 * `prefers-reduced-motion: no-preference`; otherwise its markup already
 * is the static end frame (lid open, board flat, nodes lit). Rendered after
 * the progress read, so it never blocks the data; the real map stays in the
 * DOM after it ("Skip intro" jumps there).
 */
export function ScrollScene({ progress }: { progress: readonly LevelProgress[] }) {
  const lit = new Set(progress.filter((entry) => entry.state === "passed" || entry.state === "active").map((entry) => entry.number));
  return (
    <div aria-hidden="true" inert data-scene="level-map" className="lm-scene">
      <div className="lm-stage">
        <div data-lm="laptop" className="lm-laptop">
          <div data-lm="lid" className="lm-lid" />
          <div className="lm-base" />
        </div>
        <div data-lm="xl" className="lm-xl">
          X
        </div>
        <div data-lm="board" className="lm-board">
          <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="lm-trail-svg">
            <path data-lm="trail" d="M2 10 H98" pathLength={100} className="lm-trail" />
          </svg>
          <div data-lm="nodes" className="lm-nodes">
            {CURRICULUM.map(({ number }) => (
              <span key={number} data-lit={lit.has(number) ? "true" : "false"} className={cn("lm-node", lit.has(number) && "lm-node-lit")} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
