import { SidebarContent } from "./sidebar-content";

/** Desktop App Sidebar (≥ lg): fixed 256px column on `card`. */
export function AppSidebar() {
  return (
    <aside
      aria-label="Sidebar"
      className="sticky top-0 hidden h-dvh w-(--sidebar-width) shrink-0 flex-col overflow-y-auto border-r border-border bg-card px-4 py-[22px] lg:flex"
    >
      <SidebarContent idPrefix="sidebar" />
    </aside>
  );
}
