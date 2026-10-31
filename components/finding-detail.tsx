"use client";

import { ExternalLinkIcon, HelpCircleIcon, ShieldCheckIcon, ShieldQuestionIcon } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { StatusChip } from "@/components/status-chip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ruleLabel } from "@/lib/i18n";
import type { Finding } from "@/lib/rules/types";

/**
 * Detail drawer (SPEC.md §15 step 3): both values side by side, the rule, its
 * source link, the verified badge, and the machine-generated reason.
 */
export function FindingDetail({
  finding,
  onOpenChange,
}: {
  finding: Finding | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { lang, t } = useLang();

  return (
    <Dialog open={finding !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {finding ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <StatusChip status={finding.status} />
                {finding.source?.verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-status-match-border bg-status-match-bg px-2 py-0.5 text-xs font-medium text-status-match">
                    <ShieldCheckIcon aria-hidden className="size-3" />
                    {t("results.verifiedRule")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-status-unverifiable-border bg-status-unverifiable-bg px-2 py-0.5 text-xs font-medium text-status-unverifiable">
                    <ShieldQuestionIcon aria-hidden className="size-3" />
                    {t("results.unverifiedRule")}
                  </span>
                )}
              </div>
              <DialogTitle className="text-lg leading-snug text-balance">
                {ruleLabel(lang, finding.ruleId, finding.check)}
              </DialogTitle>
              <DialogDescription>{finding.reason}</DialogDescription>
            </DialogHeader>

            {finding.left || finding.right ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {[finding.left, finding.right].filter(Boolean).map((side, index) => (
                  <div key={index} className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      {index === 0 ? t("detail.left") : t("detail.right")} ·{" "}
                      {side!.doc ? t(`docs.${side!.doc}`) : null}
                    </p>
                    <p className="mt-1 text-sm font-medium break-words">
                      {side!.value ?? t("confirm.unreadable")}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {finding.howToCheck ? (
              <div className="rounded-lg border bg-status-unverifiable-bg p-3">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <HelpCircleIcon aria-hidden className="size-4" />
                  {t("detail.howToCheck")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{finding.howToCheck}</p>
              </div>
            ) : null}

            <Separator />

            <dl className="space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-muted-foreground">{t("detail.rule")}</dt>
                <dd>
                  {finding.ruleId}
                  {finding.mismatchType ? (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                      {finding.mismatchType}
                    </span>
                  ) : null}
                </dd>
              </div>
              {finding.score !== null ? (
                <div className="flex gap-2">
                  <dt className="w-28 shrink-0 text-muted-foreground">{t("detail.score")}</dt>
                  <dd className="tabular">{finding.score.toFixed(2)}</dd>
                </div>
              ) : null}
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-muted-foreground">{t("detail.source")}</dt>
                <dd className="min-w-0">
                  {finding.source?.url ? (
                    <a
                      href={finding.source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 break-all underline underline-offset-2"
                    >
                      <ExternalLinkIcon aria-hidden className="size-3.5 shrink-0" />
                      {finding.source.note || finding.source.url}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">
                      {finding.source?.note || t("detail.sourceMissing")}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-muted-foreground">{t("results.status")}</dt>
                <dd>
                  {finding.source?.verified ? t("detail.reviewed") : t("detail.notReviewed")}
                </dd>
              </div>
            </dl>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
