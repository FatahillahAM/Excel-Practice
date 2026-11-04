import type { Metadata } from "next";
import { surfaceTitle } from "../../../components/shell/nav-items";
import { PageTitle } from "../../../components/shell/page-title";
import { levels } from "../../../content/levels";
import { LevelDetailPanel } from "./level-detail-panel";

export const metadata: Metadata = { title: surfaceTitle("Level Map") };

/**
 * Level Map: the Level Detail Panel of the first V1 level in the registry
 * (with no progress yet, the active level), inline. Progress (`completed`)
 * comes with epic 4, the Start lock with entry 7; epic 4 also adds the Level
 * Map around the panel and opens it from a Level Node in a `Sheet`.
 */
export default function Page() {
  const level = levels.find((candidate) => candidate.phase === "v1");
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Level Map</PageTitle>
      {level && <LevelDetailPanel level={level} />}
    </div>
  );
}
