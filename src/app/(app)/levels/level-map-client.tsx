"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { LevelNode, type LevelNodeData } from "@/components/levels/level-node";
import { cn } from "@/lib/utils";

/** A Level Map node with what the server worked out for it. */
export interface MapNode extends LevelNodeData {
  /** The id of the node's reason (locked), for `aria-describedby`. */
  reasonId?: string;
  reason?: string;
}

/** The phone (coarse pointer below lg, as the Start gating) turns the panel into a bottom sheet. */
const PHONE = "[@media(pointer:coarse)_and_(max-width:1023px)]";
export const SHEET_CLASS = cn(
  "flex flex-col gap-2 lg:sticky lg:top-4",
  `${PHONE}:fixed ${PHONE}:inset-x-0 ${PHONE}:bottom-0 ${PHONE}:z-40 ${PHONE}:max-h-[85dvh] ${PHONE}:overflow-y-auto`,
  `${PHONE}:rounded-t-2xl ${PHONE}:border-t ${PHONE}:border-border ${PHONE}:bg-background ${PHONE}:p-3 ${PHONE}:shadow-lg`,
);

export const panelId = (key: string) => `level-panel-${key}`;
const nodeIdBase = (key: string) => `level-node-${key}`;

/**
 * The interactive part of the Level Map: the nodes (buttons) and the Level
 * Detail Panels the server rendered, one per node, only the open one shown.
 * The panel of `defaultOpen` (the active level) is open on arrival without
 * moving focus, so Start stays one click away. Opening a node moves focus to
 * its panel's heading; closing (Close or `Escape`) returns it to that node.
 * The side track comes last in tab order.
 */
export function LevelMapClient({
  nodes,
  panels,
  defaultOpen,
}: {
  nodes: readonly MapNode[];
  panels: Readonly<Record<string, ReactNode>>;
  defaultOpen: string | null;
}) {
  const [open, setOpen] = useState<string | null>(defaultOpen);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  // What to focus after the next render: the open panel's heading, or a node.
  const pending = useRef<{ heading: string } | { node: string } | null>(null);

  useEffect(() => {
    const target = pending.current;
    pending.current = null;
    if (!target) return;
    if ("heading" in target) document.getElementById(panelId(target.heading))?.querySelector<HTMLElement>("h2")?.focus();
    else buttons.current.get(target.node)?.focus();
  }, [open]);

  const show = (key: string) => {
    pending.current = { heading: key };
    if (open === key) {
      // Already open: the effect will not run, so focus now.
      document.getElementById(panelId(key))?.querySelector<HTMLElement>("h2")?.focus();
      pending.current = null;
      return;
    }
    setOpen(key);
  };
  const close = () => {
    if (open === null) return;
    pending.current = { node: open };
    setOpen(null);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  };

  const main = nodes.filter((node) => node.key !== "side");
  const side = nodes.find((node) => node.key === "side");
  const node = (entry: MapNode) => (
    <>
      <LevelNode
        node={entry}
        idBase={nodeIdBase(entry.key)}
        describedBy={entry.reasonId}
        expanded={open === entry.key}
        controls={panelId(entry.key)}
        onOpen={() => show(entry.key)}
        buttonRef={(element) => {
          if (element) buttons.current.set(entry.key, element);
          else buttons.current.delete(entry.key);
        }}
      />
      {entry.reasonId && (
        <span id={entry.reasonId} className="sr-only">
          {entry.reason}
        </span>
      )}
    </>
  );

  return (
    <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start">
      <nav id="level-path" tabIndex={-1} aria-label="Level path" className="w-full rounded-lg border border-border bg-card p-4 outline-none sm:p-[22px]">
        <ol className="flex flex-col gap-2">
          {main.map((entry) => (
            <li key={entry.key} data-state={entry.state}>
              {node(entry)}
            </li>
          ))}
        </ol>
        {side && (
          // CAP-15: beside the path, joined to Level 8 by a dashed spur; last in tab order.
          <div data-slot="side-track" className="mt-3 ml-6 border-l-2 border-dashed border-border pl-4">
            {node(side)}
          </div>
        )}
      </nav>
      <div>
        {nodes.map((entry) => (
          <div
            key={entry.key}
            id={panelId(entry.key)}
            hidden={open !== entry.key}
            data-sheet={entry.key}
            onKeyDown={onKeyDown}
            className={SHEET_CLASS}
          >
            <button
              type="button"
              onClick={close}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-bold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <X aria-hidden="true" className="size-4" />
              Close
            </button>
            {panels[entry.key]}
          </div>
        ))}
      </div>
    </div>
  );
}
