"use client";

import { useId, useMemo, useState } from "react";
import { TipsCard } from "@/components/results/tips-card";
import { filterTips, tipLevels, type CollectedTip } from "@/core/progress";
import { shellMessages } from "@/messages/id";

const FIELD = "h-10 rounded-md border border-border bg-card px-3 text-[14px]";

/** Client part of `/tips`: level filter AND search over the collected Tips. */
export function TipsCollectionView({ tips }: { tips: readonly CollectedTip[] }) {
  const [level, setLevel] = useState<number | "all">("all");
  const [query, setQuery] = useState("");
  const levelId = useId();
  const searchId = useId();
  const levels = useMemo(() => tipLevels(tips), [tips]);
  const shown = useMemo(() => filterTips(tips, { level, query }), [tips, level, query]);

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={levelId} className="text-[12px] font-bold">
            Level
          </label>
          <select
            id={levelId}
            value={String(level)}
            onChange={(event) => setLevel(event.target.value === "all" ? "all" : Number(event.target.value))}
            className={FIELD}
          >
            <option value="all">All levels</option>
            {levels.map((n) => (
              <option key={n} value={n}>{`Level ${n}`}</option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:max-w-[320px]">
          <label htmlFor={searchId} className="text-[12px] font-bold">
            Search tips
          </label>
          <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} className={`${FIELD} w-full`} />
        </div>
      </div>
      <p aria-live="polite" data-slot="tips-count" className="text-[12px] text-muted-foreground">
        {shown.length === 1 ? "1 tip" : `${shown.length} tips`}
      </p>
      {shown.length === 0 ? (
        <div data-slot="tips-no-match" className="flex flex-wrap items-center gap-3">
          <p lang="id">{shellMessages.tipsNoMatch(level === "all" ? null : level, query)}</p>
          <button
            type="button"
            onClick={() => {
              setLevel("all");
              setQuery("");
            }}
            className="font-bold text-primary underline-offset-4 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul data-slot="tips-grid" className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map(({ tip, levelNumber }) => (
            <li key={tip.id}>
              <TipsCard tip={tip} levelNumber={levelNumber} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
