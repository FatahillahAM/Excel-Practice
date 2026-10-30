import {
  BookOpen,
  History,
  LayoutGrid,
  Lightbulb,
  Map as MapIcon,
  Settings,
  Trophy,
  type LucideIcon,
} from "lucide-react";

/**
 * Sidebar groups (EXPERIENCE.md › Information Architecture). Menu: Dashboard,
 * Level Map, History, Records, Tips & Tricks, Setup Guide. General: Settings
 * (Log out is a form, not a route). URL segments are kebab-case.
 */
export type NavItem = { href: string; label: string; icon: LucideIcon };

export const MENU_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/levels", label: "Level Map", icon: MapIcon },
  { href: "/history", label: "History", icon: History },
  { href: "/records", label: "Records", icon: Trophy },
  { href: "/tips", label: "Tips & Tricks", icon: Lightbulb },
  { href: "/setup-guide", label: "Setup Guide", icon: BookOpen },
];

export const GENERAL_ITEMS: readonly NavItem[] = [{ href: "/settings", label: "Settings", icon: Settings }];

export const NAV_ITEMS: readonly NavItem[] = [...MENU_ITEMS, ...GENERAL_ITEMS];

export const APP_NAME = "WORKING HARD with EXCEL";

/** A surface's document `<title>`: "History · WORKING HARD with EXCEL". */
export function surfaceTitle(label: string): string {
  return `${label} · ${APP_NAME}`;
}

/**
 * The item for the current surface: its own path or a path below it
 * (`/history/<id>`). Surfaces that are not menu items (Exam in progress,
 * Results) get `null`, so nothing is marked active there.
 */
export function activeNavItem(pathname: string | null | undefined): NavItem | null {
  if (!pathname) return null;
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return NAV_ITEMS.find((item) => path === item.href || path.startsWith(`${item.href}/`)) ?? null;
}
