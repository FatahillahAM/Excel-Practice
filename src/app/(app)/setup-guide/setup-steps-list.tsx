import { Kbd } from "@/components/ui/kbd";
import type { SetupStep } from "./setup-steps";

/**
 * Setup Steps (DESIGN.md › Setup Steps): a numbered list of cards, the number
 * in a `primary` circle (read out, as the list has no markers), an English title and an Indonesian body with paths
 * and menus in `Kbd`. Server-rendered; a steps list only, no completion
 * tracking (EXPERIENCE.md).
 */
export function SetupStepsList({ steps }: { steps: readonly SetupStep[] }) {
  return (
    // `role="list"`: Safari drops list semantics from a list without markers.
    <ol role="list" className="flex flex-col gap-[14px]">
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-4 rounded-lg border border-border bg-card p-4">
          {/* The visible number is the step's announced number (the list has no markers). */}
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-mono text-[15px] font-bold text-primary-foreground tabular-nums"
          >
            {index + 1}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-[17px] leading-[1.3] font-bold">{step.title}</h2>
            <p lang="id" className="leading-[1.6] text-muted-foreground">
              {step.body.map((part, i) => (typeof part === "string" ? part : <Kbd key={i}>{part.kbd}</Kbd>))}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
