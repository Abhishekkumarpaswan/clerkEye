"use client";

import { CheckCircle2Icon, HelpCircleIcon, TriangleAlertIcon, XCircleIcon } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import type { Status } from "@/lib/match/types";
import { cn } from "@/lib/utils";

/**
 * A status is always colour + icon + text label (DESIGN.md). Never colour alone.
 */
export const STATUS_META: Record<
  Status,
  { icon: typeof CheckCircle2Icon; className: string; bg: string; border: string }
> = {
  MATCH: {
    icon: CheckCircle2Icon,
    className: "text-status-match",
    bg: "bg-status-match-bg",
    border: "border-status-match-border",
  },
  WARNING: {
    icon: TriangleAlertIcon,
    className: "text-status-warning",
    bg: "bg-status-warning-bg",
    border: "border-status-warning-border",
  },
  CRITICAL: {
    icon: XCircleIcon,
    className: "text-status-critical",
    bg: "bg-status-critical-bg",
    border: "border-status-critical-border",
  },
  UNVERIFIABLE: {
    icon: HelpCircleIcon,
    className: "text-status-unverifiable",
    bg: "bg-status-unverifiable-bg",
    border: "border-status-unverifiable-border",
  },
};

export function StatusIcon({ status, className }: { status: Status; className?: string }) {
  const Icon = STATUS_META[status].icon;
  return <Icon aria-hidden className={cn("size-4 shrink-0", STATUS_META[status].className, className)} />;
}

export function StatusChip({
  status,
  short = false,
  className,
}: {
  status: Status;
  short?: boolean;
  className?: string;
}) {
  const { t } = useLang();
  const meta = STATUS_META[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-semibold",
        meta.className,
        meta.bg,
        meta.border,
        className,
      )}
    >
      <StatusIcon status={status} className="size-3.5" />
      {t(`status.${status}${short ? ".short" : ""}`)}
    </span>
  );
}
