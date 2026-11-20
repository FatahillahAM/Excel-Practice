import { Check, Construction, Flag, Flame, Lock } from "lucide-react";
import type { Ref } from "react";
import type { LevelState } from "@/core/progress";
import { cn } from "@/lib/utils";

/**
 * Level Node (EXPERIENCE.md › Level Node): one implementation of a node's
 * visible row (state icon, "Level N", the Indonesian name, the state label)
 * for the Dashboard's Level Path and the Level Map. On the Level Path the row
 * sits in a list item; on the Level Map `LevelNode` wraps it in a button
 * named by its visible spans (`aria-labelledby`), `aria-current="step"` when
 * active and the locked reason in `aria-describedby`.
 */

export const STATE_LABEL: Record<LevelState, string> = {
  passed: "Passed",
  active: "Active",
  locked: "Locked",
  under_construction: "Under Construction",
};

export const STATE_ICON = { passed: Check, active: Flame, locked: Lock, under_construction: Construction } as const;

const LABEL = "font-mono text-[10.5px] leading-[1.2] font-bold tracking-[0.1em] uppercase";

export interface LevelNodeData {
  /** Unique per node: "1"…"9", "final", "side". */
  key: string;
  /** The curriculum number; `null` for Ujian Akhir and the side track. */
  number: number | null;
  name: string;
  state: LevelState;
  /** Ujian Akhir shows a flag instead of the state icon. */
  final?: boolean;
  /** A visible caption under the row, part of the node's name (the active node's "x/5 practices done"). */
  detail?: string;
}

/** The visible row; `idBase` gives its spans ids for `aria-labelledby`. */
export function LevelNodeRow({ node, idBase }: { node: LevelNodeData; idBase?: string }) {
  const Icon = node.final ? Flag : STATE_ICON[node.state];
  const muted = node.state === "locked" || node.state === "under_construction";
  const id = (part: string) => (idBase ? `${idBase}-${part}` : undefined);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Icon aria-hidden="true" className={cn("size-4 shrink-0", !muted && "text-primary")} />
      <span className="min-w-0 flex-1 truncate">
        {node.number !== null && (
          <>
            <span id={id("number")} className="font-bold">
              Level {node.number}
            </span>{" "}
          </>
        )}
        <span id={id("name")} lang="id" className={cn(node.number === null && "font-bold")}>
          {node.name}
        </span>
      </span>
      <span id={id("state")} className={cn(LABEL, "shrink-0")}>
        {STATE_LABEL[node.state]}
      </span>
    </div>
  );
}

/** The Level Map's node: a button that opens the Level Detail Panel (`Enter` / click). */
export function LevelNode({
  node,
  idBase,
  describedBy,
  expanded,
  controls,
  onOpen,
  buttonRef,
  className,
}: {
  node: LevelNodeData;
  idBase: string;
  describedBy?: string;
  expanded: boolean;
  controls: string;
  onOpen: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
  className?: string;
}) {
  const active = node.state === "active";
  const muted = node.state === "locked" || node.state === "under_construction";
  const labelledBy = [
    node.number !== null ? `${idBase}-number` : null,
    `${idBase}-name`,
    `${idBase}-state`,
    node.detail ? `${idBase}-detail` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      ref={buttonRef}
      type="button"
      data-state={node.state}
      data-node={node.key}
      aria-current={active ? "step" : undefined}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onOpen}
      className={cn(
        "w-full rounded-md px-3 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active && "bg-muted shadow-[inset_0_0_0_1.5px_var(--primary)]",
        node.state === "under_construction" &&
          "bg-[repeating-linear-gradient(-45deg,var(--muted)_0_4px,transparent_4px_8px)]",
        muted && "text-muted-foreground",
        expanded && !active && "shadow-[inset_0_0_0_1.5px_var(--border)]",
        className,
      )}
    >
      <LevelNodeRow node={node} idBase={idBase} />
      {node.detail && (
        <span id={`${idBase}-detail`} className="mt-1 block pl-7 text-xs leading-[1.4] font-medium text-muted-foreground">
          {node.detail}
        </span>
      )}
    </button>
  );
}
