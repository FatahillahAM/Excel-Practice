import { AppSidebar } from "@/components/shell/app-sidebar";
import { HeaderBar } from "@/components/shell/header-bar";
import { PreferencesProvider } from "@/components/shell/preferences-provider";
import { readPreferences } from "@/lib/preferences-server";

/**
 * App shell for every signed-in surface (DESIGN.md › Layout & Spacing ›
 * Desktop shell): App Sidebar ≥ lg, Mobile Drawer below, sticky Header Bar,
 * content padded 32px (16px on phones). The proxy already sends visitors
 * without a session to Login.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const preferences = await readPreferences();
  return (
    <PreferencesProvider initial={preferences}>
      <div data-app-shell="" className="flex min-h-dvh">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <HeaderBar />
          <main id="main" className="flex-1 px-4 pt-6 pb-8 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    </PreferencesProvider>
  );
}
