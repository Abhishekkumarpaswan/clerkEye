"use client";

import { HelpCircleIcon } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { StatusChip, StatusIcon } from "@/components/status-chip";
import { Button } from "@/components/ui/button";
import { DOC_TYPES, type DocType } from "@/lib/extract/schemas";
import { ruleLabel } from "@/lib/i18n";
import type { Finding } from "@/lib/rules/types";
import { cn } from "@/lib/utils";

/**
 * The result matrix (SPEC.md §15 step 3).
 *
 * Desktop: documents as columns, checks as rows. Mobile: one stacked card per
 * check. Every cell has an icon, a colour and a text label; clicking a cell opens
 * the detail drawer.
 */
export function ResultsMatrix({
  findings,
  uploaded,
  onOpen,
}: {
  findings: Finding[];
  uploaded: DocType[];
  onOpen: (finding: Finding) => void;
}) {
  const { lang, t } = useLang();
  const columns = DOC_TYPES.filter((doc) => uploaded.includes(doc));

  return (
    <div>
      {/* Desktop / tablet: the matrix */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t("results.matrixCaption")}</caption>
          <thead>
            <tr className="border-b bg-muted/50">
              <th scope="col" className="p-3 text-left font-medium">
                {t("results.checkColumn")}
              </th>
              {columns.map((doc) => (
                <th key={doc} scope="col" className="p-3 text-left font-medium">
                  {t(`docs.${doc}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {findings.map((finding) => (
              <tr key={finding.rowKey} className="border-b last:border-0 align-top">
                <th scope="row" className="max-w-[16rem] p-3 text-left font-normal">
                  <span className="font-medium">{ruleLabel(lang, finding.ruleId, finding.check)}</span>
                  {finding.source && !finding.source.verified ? (
                    <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <HelpCircleIcon aria-hidden className="size-3" />
                      {t("results.unverifiedRule")}
                    </span>
                  ) : null}
                </th>
                {columns.map((doc) => {
                  const involved = finding.documents.includes(doc);
                  return (
                    <td key={doc} className="p-2">
                      {involved ? (
                        <button
                          type="button"
                          onClick={() => onOpen(finding)}
                          className={cn(
                            "flex min-h-11 w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left",
                            "hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2",
                          )}
                        >
                          <StatusChip status={finding.status} short />
                          <span className="truncate text-xs text-muted-foreground">
                            {finding.left?.doc === doc
                              ? finding.left?.value ?? t("confirm.unreadable")
                              : finding.right?.doc === doc
                                ? finding.right?.value ?? t("confirm.unreadable")
                                : ""}
                          </span>
                        </button>
                      ) : (
                        <span className="block px-2 py-2 text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="space-y-3 md:hidden">
        <li className="text-sm text-muted-foreground">{t("results.mobileHint")}</li>
        {findings.map((finding) => (
          <li key={finding.rowKey}>
            <button
              type="button"
              onClick={() => onOpen(finding)}
              className="w-full rounded-xl border bg-card p-3 text-left"
            >
              <div className="flex items-start gap-2">
                <StatusIcon status={finding.status} className="mt-0.5 size-5" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">
                    {ruleLabel(lang, finding.ruleId, finding.check)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {finding.left ? `${t(`docs.${finding.left.doc}`)}: ${finding.left.value ?? t("confirm.unreadable")}` : null}
                    {finding.right
                      ? ` · ${t(`docs.${finding.right.doc}`)}: ${finding.right.value ?? t("confirm.unreadable")}`
                      : null}
                  </p>
                  <div className="mt-2">
                    <StatusChip status={finding.status} />
                  </div>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ResultsSummary({
  counts,
  onContinue,
}: {
  counts: { MATCH: number; WARNING: number; CRITICAL: number; UNVERIFIABLE: number };
  onContinue: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm" aria-live="polite">
        {t("results.summary", {
          critical: counts.CRITICAL,
          warning: counts.WARNING,
          unverifiable: counts.UNVERIFIABLE,
          match: counts.MATCH,
        })}
      </p>
      <Button className="mt-3 min-h-11 w-full sm:w-auto" onClick={onContinue}>
        {t("results.viewFixes")}
      </Button>
    </div>
  );
}
