import { cn } from "@/lib/utils";

/** Sheet/grid glyph on a primary tile with green glow (DESIGN.md › Spreadsheet DNA). */
export function LogoTile({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-[10px] bg-primary text-primary-foreground shadow-[0_6px_18px_-4px_var(--glow-strong)]",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M3 9h18M3 15h18M9 3v18" />
      </svg>
    </span>
  );
}

/** Brand block: logo tile + "WORKING HARD / with EXCEL". */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoTile />
      <div>
        <b className="block text-[13px] leading-[1.1] font-extrabold tracking-[0.04em]">WORKING HARD</b>
        <span className="block text-[11px] font-bold tracking-[0.02em] text-primary">with EXCEL</span>
      </div>
    </div>
  );
}
