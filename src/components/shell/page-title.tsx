import { cn } from "@/lib/utils";

/** Page title in `headline` (DESIGN.md › Typography); `id` + `tabIndex={-1}` let a page move focus to it. */
export function PageTitle({
  children,
  className,
  id,
  tabIndex,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  tabIndex?: number;
}) {
  return (
    <h1
      id={id}
      tabIndex={tabIndex}
      className={cn(
        "text-[32px] leading-[1.1] font-[850] tracking-[-0.025em]",
        // A programmatic focus target, not a control: no focus ring.
        tabIndex !== undefined && "outline-none",
        className,
      )}
    >
      {children}
    </h1>
  );
}

/**
 * A surface whose content is not built yet: the shell and its title only, with
 * the secondary page entrance (History, Records, Tips & Tricks).
 */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="page-enter">
      <PageTitle>{title}</PageTitle>
    </div>
  );
}
