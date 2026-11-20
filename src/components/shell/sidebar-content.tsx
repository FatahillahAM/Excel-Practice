"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import type { CurriculumSummary } from "@/core/progress";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { GENERAL_ITEMS, MENU_ITEMS, activeNavItem, type NavItem } from "./nav-items";

const ITEM_BASE =
  "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left [transition:background-color_.2s,color_.2s,transform_.3s]";
const ITEM_INACTIVE = "font-[550] text-muted-foreground hover:translate-x-1 hover:bg-muted hover:text-foreground";
const ITEM_ACTIVE =
  "bg-primary font-bold text-primary-foreground shadow-[0_0_0_1px_var(--glow-strong),0_10px_26px_-8px_var(--glow-strong)]";

function GroupLabel({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p
      id={id}
      className="mx-3 mt-[18px] mb-2 font-mono text-[11px] leading-[1.2] font-bold tracking-[0.1em] text-muted-foreground uppercase"
    >
      {children}
    </p>
  );
}

function NavLink({
  item,
  active,
  touch,
  badge,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  touch: boolean;
  /** A short count after the label ("L1" on Level Map). */
  badge?: { text: string; label: string };
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <li>
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={cn(ITEM_BASE, active ? ITEM_ACTIVE : ITEM_INACTIVE, touch && "min-h-11")}
      >
        <Icon aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.9} />
        {item.label}
        {badge && (
          <span
            data-slot="nav-badge"
            className={cn(
              "ml-auto rounded-sm px-1.5 py-0.5 font-mono text-[11px] leading-none font-bold",
              active ? "bg-primary-foreground/20" : "bg-muted text-foreground",
            )}
          >
            <span aria-hidden="true">{badge.text}</span>
            <span className="sr-only">{badge.label}</span>
          </span>
        )}
      </Link>
    </li>
  );
}

/**
 * App Sidebar contents, shared by the desktop sidebar and the Mobile Drawer
 * (DESIGN.md › App Sidebar): brand block, "Menu" and "General" groups, the
 * active item marked with `aria-current="page"`; with `summary`, the Level
 * Map badge "L{active level}" and the footer "{passed} of 9 levels passed".
 */
export function SidebarContent({
  idPrefix,
  touch = false,
  summary = null,
  onNavigate,
}: {
  /** Keeps label ids unique between the sidebar and the drawer. */
  idPrefix: string;
  /** Mobile Drawer: 44px rows. */
  touch?: boolean;
  /** From `levelProgress` (`curriculumSummary`); `null` hides the badge and footer. */
  summary?: CurriculumSummary | null;
  onNavigate?: () => void;
}) {
  const active = activeNavItem(usePathname());
  const menuId = `${idPrefix}-menu`;
  const generalId = `${idPrefix}-general`;
  return (
    <>
      <Logo className="px-2 pb-[18px]" />
      <GroupLabel id={menuId}>Menu</GroupLabel>
      <nav aria-labelledby={menuId}>
        <ul className="flex flex-col gap-0.5">
          {MENU_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={active === item}
              touch={touch}
              badge={item.href === "/levels" && summary ? { text: `L${summary.activeLevel}`, label: `, Level ${summary.activeLevel}` } : undefined}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </nav>
      <GroupLabel id={generalId}>General</GroupLabel>
      <nav aria-labelledby={generalId}>
        <ul className="flex flex-col gap-0.5">
          {GENERAL_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} active={active === item} touch={touch} onNavigate={onNavigate} />
          ))}
          <li>
            {/* Log out (CAP-17): ends this device's session, then Login. */}
            <form action="/auth/signout" method="post">
              <button type="submit" className={cn(ITEM_BASE, ITEM_INACTIVE, "cursor-pointer", touch && "min-h-11")}>
                <LogOut aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.9} />
                Log out
              </button>
            </form>
          </li>
        </ul>
      </nav>
      {summary && (
        <div data-slot="curriculum-progress" className="sticky bottom-0 mx-3 mt-auto bg-card pt-6">
          <p className="text-[13px] font-[550] text-muted-foreground">{`${summary.passed} of ${summary.total} levels passed`}</p>
          <div
            role="progressbar"
            aria-label="Levels passed"
            aria-valuemin={0}
            aria-valuemax={summary.total}
            aria-valuenow={summary.passed}
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${(summary.passed / summary.total) * 100}%` }} />
          </div>
        </div>
      )}
    </>
  );
}
