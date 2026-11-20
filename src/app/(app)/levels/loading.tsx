import { PageTitle } from "@/components/shell/page-title";
import { LevelPathSkeleton } from "../dashboard/level-path";

/** While the progress read runs: the title and a path-shaped skeleton (the scene waits for the data). */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <PageTitle>Level Map</PageTitle>
      <LevelPathSkeleton />
    </div>
  );
}
