"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
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
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  touch: boolean;
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
      </Link>
    </li>
  );
}

/**
 * App Sidebar contents, shared by the desktop sidebar and the Mobile Drawer
 * (DESIGN.md › App Sidebar): brand block, "Menu" and "General" groups, the
 * active item marked with `aria-current="page"`.
 */
export function SidebarContent({
  idPrefix,
  touch = false,
  onNavigate,
}: {
  /** Keeps label ids unique between the sidebar and the drawer. */
  idPrefix: string;
  /** Mobile Drawer: 44px rows. */
  touch?: boolean;
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
            // Level Map's "L3" count is hidden until the progress epic.
            <NavLink key={item.href} item={item} active={active === item} touch={touch} onNavigate={onNavigate} />
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
      {/* Footer slot: the curriculum progress bar lands with the progress epic. */}
    </>
  );
}
