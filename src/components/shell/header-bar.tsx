"use client";

import { usePathname } from "next/navigation";
import { AvatarMenu } from "./avatar-menu";
import { MobileDrawer } from "./mobile-drawer";
import { activeNavItem } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

/**
 * Header Bar (all signed-in surfaces): sticky, 68px, bottom border. Desktop:
 * right cluster only (Streak Chip slot, Theme Toggle, avatar menu). Below lg
 * it is the phone top bar: "Open menu", the surface title, the avatar.
 */
export function HeaderBar() {
  const title = activeNavItem(usePathname())?.label ?? "";
  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) items-center gap-3 border-b border-border bg-background px-4 lg:px-8">
      <MobileDrawer />
      <div className="min-w-0 flex-1 truncate text-center text-[15px] font-extrabold lg:hidden">{title}</div>
      <div className="hidden flex-1 lg:block" />
      {/* Streak Chip slot: lands with the progress epic. */}
      <ThemeToggle className="hidden sm:flex" />
      <AvatarMenu />
    </header>
  );
}
