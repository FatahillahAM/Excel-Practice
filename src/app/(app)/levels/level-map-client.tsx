"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LevelNode, type LevelNodeData } from "@/components/levels/level-node";
import { Sheet, SheetOverlay, SheetPortal } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { PHONE_QUERY } from "./start-control";

/** A Level Map node with what the server worked out for it. */
export interface MapNode extends LevelNodeData {
  /** The id of the node's panel heading (focus target on open). */
  headingId: string;
  /** The id of the node's reason (locked), for `aria-describedby`. */
  reasonId?: string;
  reason?: string;
}

/** The phone (coarse pointer below lg, as the Start gating). */
const PHONE = "[@media(pointer:coarse)_and_(max-width:1023px)]";
/** The inline (desktop) panel column; hidden on a phone, where the bottom sheet takes over. */
export const INLINE_CLASS = cn("flex flex-col gap-2 lg:sticky lg:top-4", `${PHONE}:hidden`);
/** The phone bottom sheet (Sheet / radix Dialog: dialog role, focus trap, scrim, Escape, the rest inert). */
export const SHEET_CLASS =
  "fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col gap-2 overflow-y-auto rounded-t-2xl border-t border-border bg-background p-3 text-foreground shadow-lg outline-none";

export const panelId = (key: string) => `level-panel-${key}`;
const nodeIdBase = (key: string) => `level-node-${key}`;

const CLOSE_BUTTON =
  "ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-bold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";

function usePhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(PHONE_QUERY);
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return phone;
}

/**
 * The interactive part of the Level Map: the nodes (buttons) and the Level
 * Detail Panels the server rendered, one per node. On a laptop the panel of
 * `defaultOpen` (the active level) is open inline on arrival without moving
 * focus, so Start stays one click away; opening a node moves focus to its
 * panel heading, closing (Close or `Escape` anywhere) returns it to the node.
 * On a phone nothing opens on arrival: a tapped node opens its panel in a
 * bottom sheet (the shell's Sheet), and closing it returns focus to the node.
 * The side track is last in DOM and tab order, drawn beside Level 8.
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
  const phone = usePhone();
  const [open, setOpen] = useState<string | null>(defaultOpen);
  const [sheet, setSheet] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  // What to focus after the next render: a heading id, or a node key.
  const pending = useRef<{ heading: string } | { node: string } | null>(null);
  const byKey = new Map(nodes.map((node) => [node.key, node]));

  useEffect(() => {
    const target = pending.current;
    pending.current = null;
    if (!target) return;
    if ("heading" in target) document.getElementById(target.heading)?.focus();
    else buttons.current.get(target.node)?.focus();
  }, [open]);

  const close = () => {
    if (open === null) return;
    pending.current = { node: open };
    setOpen(null);
  };

  // Escape closes the inline panel wherever focus is (the sheet handles its own).
  useEffect(() => {
    if (open === null || sheet !== null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      pending.current = { node: open };
      setOpen(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, sheet]);

  const show = (key: string) => {
    if (phone) {
      setSheet(key);
      return;
    }
    const headingId = byKey.get(key)?.headingId;
    if (open === key) {
      // Already open: no re-render, so focus now.
      if (headingId) document.getElementById(headingId)?.focus();
      return;
    }
    if (headingId) pending.current = { heading: headingId };
    setOpen(key);
  };

  const main = nodes.filter((node) => node.key !== "side");
  const side = nodes.find((node) => node.key === "side");
  const node = (entry: MapNode) => (
    <>
      <LevelNode
        node={entry}
        idBase={nodeIdBase(entry.key)}
        describedBy={entry.reasonId}
        expanded={(phone ? sheet : open) === entry.key}
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
  const sheetNode = sheet !== null ? byKey.get(sheet) : undefined;

  return (
    <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start">
      <nav id="level-path" tabIndex={-1} aria-label="Level path" className="w-full rounded-lg border border-border bg-card p-4 outline-none sm:p-[22px]">
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,13rem)]">
          {main.map((entry) => (
            <li key={entry.key} data-state={entry.state} className="sm:col-start-1">
              {node(entry)}
            </li>
          ))}
          {side && (
            // CAP-15: last in DOM and tab order; drawn beside Level 8 (row 8) with a dashed spur.
            <li
              key={side.key}
              data-state={side.state}
              data-slot="side-track"
              className="ml-6 border-l-2 border-dashed border-border pl-4 sm:col-start-2 sm:row-start-8 sm:ml-0"
            >
              {node(side)}
            </li>
          )}
        </ol>
      </nav>
      <div className={INLINE_CLASS}>
        {nodes.map((entry) => (
          <div key={entry.key} id={panelId(entry.key)} hidden={open !== entry.key} data-inline={entry.key} className="flex flex-col gap-2">
            <button type="button" onClick={close} className={CLOSE_BUTTON}>
              <X aria-hidden="true" className="size-4" />
              Close
            </button>
            {/* One copy of a panel at a time: the sheet's while it shows it. */}
            {sheet !== entry.key && panels[entry.key]}
          </div>
        ))}
      </div>
      <Sheet open={sheetNode !== undefined} onOpenChange={(next) => !next && setSheet(null)}>
        {sheetNode && (
          <SheetPortal>
            <SheetOverlay />
            <Dialog.Content
              data-slot="level-sheet"
              data-sheet={sheetNode.key}
              aria-describedby={undefined}
              className={SHEET_CLASS}
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                document.getElementById(sheetNode.headingId)?.focus();
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                buttons.current.get(sheetNode.key)?.focus();
              }}
            >
              <Dialog.Title className="sr-only">{sheetNode.name}</Dialog.Title>
              <Dialog.Close className={CLOSE_BUTTON}>
                <X aria-hidden="true" className="size-4" />
                Close
              </Dialog.Close>
              {panels[sheetNode.key]}
            </Dialog.Content>
          </SheetPortal>
        )}
      </Sheet>
    </div>
  );
}
