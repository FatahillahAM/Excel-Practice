import * as React from "react";

import { cn } from "../../lib/utils";

/**
 * A key or an Excel menu path, rendered statically (DESIGN.md › Kbd:
 * `muted` fill, `input-border` border with a 2px bottom, `kbd` type).
 * Always `lang="en"` (set after the props, so it cannot be overridden): keys and menus are Excel's English names verbatim
 * (EXPERIENCE.md › Kbd). Shared by Setup Steps and, later, Tips Cards.
 */
function Kbd({ className, ...props }: Omit<React.ComponentProps<"kbd">, "lang">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        // Inline (not inline-block) with cloned decoration, so a long menu path wraps on a phone
        // and every line keeps its own fill, border and padding.
        "inline rounded-[6px] border border-b-2 border-input-border bg-muted px-1.5 py-px font-mono text-[11px] leading-[1.9] font-medium [overflow-wrap:anywhere] text-foreground [box-decoration-break:clone] [-webkit-box-decoration-break:clone]",
        className,
      )}
      {...props}
      lang="en"
    />
  );
}

export { Kbd };
