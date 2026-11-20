import type { ReactNode } from "react";
import type { LevelModule } from "@/core/content/level-module";
import { FINAL_EXAM_NAME, type ItemRecord, type LevelProgress } from "@/core/progress";
import { levels } from "@/content/levels";
import { LevelDetailPanel, ReadOnlyLevelPanel } from "./level-detail-panel";
import { LevelMapClient, type MapNode } from "./level-map-client";
import { completedItemIds, lockedReason, PRACTICE_COUNT, testResult } from "./level-panel";
import type { StartLock } from "./start-lock";

/** The CAP-15 side track (Next): an Under Construction node beside Level 8 (`key-level-map.html`). */
export const SIDE_TRACK_NAME = "Co-authoring";

/** The level whose panel is open on arrival: the active one, else the last passed (after Level 4), else none. */
export function defaultOpenLevel(progress: readonly LevelProgress[]): LevelProgress | undefined {
  return progress.find((entry) => entry.state === "active") ?? progress.findLast((entry) => entry.state === "passed");
}

/**
 * Level Map (EXPERIENCE.md › Level Map; CAP-1, CAP-9, CAP-15): Level 1 →
 * Ujian Akhir and the side track as Level Nodes, states from `levelProgress`
 * only (AD-7; the same view model as the Dashboard's Level Path), each node
 * opening its Level Detail Panel (read-only for locked / Under Construction).
 * Start keeps going through `canStart` on the server (4.3).
 */
export function LevelMapView({
  progress,
  modules = levels,
  records,
  bestScores,
  startLock,
}: {
  progress: readonly LevelProgress[];
  modules?: readonly LevelModule[];
  records?: ReadonlyMap<string, ItemRecord>;
  bestScores?: ReadonlyMap<string, number>;
  startLock?: StartLock;
}) {
  const nodes: MapNode[] = [];
  const panels: Record<string, ReactNode> = {};
  for (const level of progress) {
    const key = String(level.number);
    const mod = modules.find((candidate) => candidate.number === level.number);
    const locked = level.state === "locked";
    nodes.push({
      key,
      number: level.number,
      name: level.name,
      state: level.state,
      detail: level.state === "active" ? `${level.practicesDone.size}/${PRACTICE_COUNT} practices done` : undefined,
      reasonId: locked ? `level-node-${key}-reason` : undefined,
      reason: locked ? lockedReason(level.number) : undefined,
    });
    panels[key] = mod ? (
      <LevelDetailPanel
        level={mod}
        state={level.state}
        completed={completedItemIds(mod, progress)}
        result={testResult(mod, progress)}
        records={records}
        bestScores={bestScores}
        startLock={startLock}
      />
    ) : (
      <ReadOnlyLevelPanel
        idBase={`level-${key}`}
        number={level.number}
        name={level.name}
        state={level.state === "locked" ? "locked" : "under_construction"}
      />
    );
  }
  nodes.push({ key: "final", number: null, name: FINAL_EXAM_NAME, state: "under_construction", final: true });
  panels.final = <ReadOnlyLevelPanel idBase="level-final" number={null} name={FINAL_EXAM_NAME} state="under_construction" />;
  nodes.push({ key: "side", number: null, name: SIDE_TRACK_NAME, state: "under_construction" });
  panels.side = <ReadOnlyLevelPanel idBase="level-side" number={null} name={SIDE_TRACK_NAME} state="under_construction" />;

  const open = defaultOpenLevel(progress);
  return <LevelMapClient nodes={nodes} panels={panels} defaultOpen={open ? String(open.number) : null} />;
}
