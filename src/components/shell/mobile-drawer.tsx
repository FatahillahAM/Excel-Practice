"use client";

import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarContent } from "./sidebar-content";

/**
 * Mobile Drawer (< lg): "Open menu" opens the App Sidebar contents in a left
 * Sheet (286px). Closes on scrim, `Esc` or navigation; focus goes to the
 * first item on open and back to the menu button on close, trapped while open.
 */
export function MobileDrawer() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [shownPath, setShownPath] = useState(pathname);
  const contentRef = useRef<HTMLDivElement>(null);

  // Any navigation (also back/forward) closes the drawer.
  if (pathname !== shownPath) {
    setShownPath(pathname);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-md border border-border bg-card text-foreground lg:hidden"
      >
        <Menu aria-hidden="true" className="size-[18px]" strokeWidth={1.9} />
      </SheetTrigger>
      <SheetContent
        ref={contentRef}
        aria-describedby={undefined}
        className="w-(--drawer-width) max-w-[calc(100vw-3rem)] overflow-y-auto px-4 py-[22px]"
        onOpenAutoFocus={(event) => {
          const first = contentRef.current?.querySelector<HTMLElement>("nav a");
          if (!first) return;
          event.preventDefault();
          first.focus();
        }}
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SidebarContent idPrefix="drawer" touch onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
