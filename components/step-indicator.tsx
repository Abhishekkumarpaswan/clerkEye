"use client";

import { CheckIcon } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { STEP_ORDER, stepIndex, type Step } from "@/lib/check-state";
import { cn } from "@/lib/utils";

const LABEL_KEYS: Record<Step, string> = {
  upload: "wizard.step.upload",
  confirm: "wizard.step.confirm",
  results: "wizard.step.results",
  fix: "wizard.step.fix",
};

/**
 * Step indicator: numbers plus labels, with the current step announced as
 * "Step n of 4" for screen readers. Not colour-only: done steps also show a tick.
 */
export function StepIndicator({ current }: { current: Step }) {
  const { t } = useLang();
  const currentIndex = stepIndex(current);

  return (
    <nav aria-label={t("wizard.title")} className="w-full">
      <p className="sr-only" aria-live="polite">
        {t("wizard.stepOf", { current: currentIndex + 1, total: STEP_ORDER.length })}
      </p>
      <ol className="flex items-center gap-1 overflow-x-auto text-sm">
        {STEP_ORDER.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li
              key={step}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2",
                active && "bg-accent",
              )}
              aria-current={active ? "step" : undefined}
            >
              <span
                aria-hidden
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                  done && "border-status-match bg-status-match text-white",
                  active && "border-primary bg-primary text-primary-foreground",
                  !done && !active && "border-border bg-muted text-muted-foreground",
                )}
              >
                {done ? <CheckIcon className="size-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "truncate",
                  active ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {t(LABEL_KEYS[step])}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
