import { cn } from "@/lib/utils";

/** Page title in `headline` (DESIGN.md › Typography). */
export function PageTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h1 className={cn("text-[32px] leading-[1.1] font-[850] tracking-[-0.025em]", className)}>{children}</h1>;
}

/**
 * A surface whose content is not built yet: the shell and its title only.
 * `enter` plays the secondary page entrance (History, Records, Tips & Tricks,
 * Setup Guide, Settings).
 */
export function PlaceholderPage({ title, enter = false }: { title: string; enter?: boolean }) {
  return (
    <div className={cn(enter && "page-enter")}>
      <PageTitle>{title}</PageTitle>
    </div>
  );
}
