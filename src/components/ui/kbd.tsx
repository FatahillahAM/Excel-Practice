import * as React from "react";

import { cn } from "../../lib/utils";

/**
 * A key or an Excel menu path, rendered statically (DESIGN.md › Kbd:
 * `muted` fill, `input-border` border with a 2px bottom, `kbd` type).
 * Always `lang="en"`: keys and menus are Excel's English names verbatim
 * (EXPERIENCE.md › Kbd). Shared by Setup Steps and, later, Tips Cards.
 */
function Kbd({ className, ...props }: Omit<React.ComponentProps<"kbd">, "lang">) {
  return (
    <kbd
      data-slot="kbd"
      lang="en"
      className={cn(
        "inline-block rounded-[6px] border border-b-2 border-input-border bg-muted px-1.5 py-px align-baseline font-mono text-[11px] leading-[1.4] font-medium break-words text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Kbd };
