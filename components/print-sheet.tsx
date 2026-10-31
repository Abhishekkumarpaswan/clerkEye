"use client";

import { useLang } from "@/components/lang-provider";
import { StatusIcon } from "@/components/status-chip";
import { ruleLabel } from "@/lib/i18n";
import { remedyForFinding, remedyKeys } from "@/lib/remedies/remedies";
import { declarationText } from "@/lib/explain/templates";
import type { Finding } from "@/lib/rules/types";

/**
 * Print view (SPEC.md §13, DESIGN.md).
 *
 * Black-and-white safe, one page, no background colours: statuses are carried by
 * an icon and the text label, which is exactly why the status chip never relies
 * on colour alone. Rendered always, shown only by `@media print`.
 */
export function PrintSheet({
  findings,
  date,
  applicantName,
  fatherName,
  institute,
}: {
  findings: Finding[];
  date: string;
  applicantName: string | null;
  fatherName: string | null;
  institute: string | null;
}) {
  const { lang, t } = useLang();
  const actionable = findings.filter((finding) => finding.status !== "MATCH");
  const matches = findings.filter((finding) => finding.status === "MATCH");
  const unverifiable = findings.filter((finding) => finding.status === "UNVERIFIABLE");
  const fixable = actionable.filter((finding) => !finding.howToCheck);
  const showDeclaration = actionable.some(
    (finding) => finding.status === "WARNING" && (finding.mismatchType ?? "").startsWith("NAME_"),
  );

  return (
    <section id="print-sheet" className="print-sheet hidden print:block" aria-hidden>
      <header className="print-head">
        <h1>{t("print.title")}</h1>
        <p>{t("print.subtitle", { date })}</p>
      </header>

      <h2>{t("print.findings")}</h2>
      {actionable.length === 0 ? <p>{t("print.noIssues")}</p> : null}
      <ul className="print-list">
        {actionable.map((finding) => (
          <li key={finding.rowKey}>
            <StatusIcon status={finding.status} className="print-icon" />
            <strong>{ruleLabel(lang, finding.ruleId, finding.check)}</strong>
            <span className="print-status">[{t(`status.${finding.status}`)}]</span>
            <br />
            {finding.left ? `${t(`docs.${finding.left.doc}`)}: ${finding.left.value ?? t("confirm.unreadable")}` : null}
            {finding.right
              ? ` · ${t(`docs.${finding.right.doc}`)}: ${finding.right.value ?? t("confirm.unreadable")}`
              : null}
          </li>
        ))}
      </ul>

      {matches.length > 0 ? (
        <p className="print-muted">
          {matches.length} {t("status.MATCH").toLowerCase()}
        </p>
      ) : null}

      {fixable.length > 0 ? (
        <>
          <h2>{t("print.fixes")}</h2>
          <ol className="print-list">
            {fixable.map((finding) => {
              const remedy = remedyForFinding(finding);
              const keys = remedy ? remedyKeys(remedy) : null;
              return (
                <li key={`fix-${finding.rowKey}`}>
                  <strong>{ruleLabel(lang, finding.ruleId, finding.check)}</strong>
                  {keys ? (
                    <>
                      <br />
                      {t("fix.what")}: {t(keys.what)}
                      <br />
                      {t("fix.where")}: {t(keys.where)}
                      <br />
                      {t("fix.carry")}: {t(keys.carry)}
                    </>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <p className="print-muted">{t("fix.reviewedNote")}</p>
        </>
      ) : null}

      {unverifiable.length > 0 ? (
        <>
          <h2>{t("print.unverifiable")}</h2>
          <ul className="print-list">
            {unverifiable.map((finding) => (
              <li key={`uv-${finding.rowKey}`}>
                <strong>{ruleLabel(lang, finding.ruleId, finding.check)}</strong>
                {finding.howToCheck ? <> — {finding.howToCheck}</> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {showDeclaration ? (
        <div className="print-declaration">
          <h2>{t("declaration.title")}</h2>
          <p className="print-muted">{t("declaration.disclaimer")}</p>
          <pre>{declarationText(lang, { applicantName, fatherName, institute: institute ?? "________________" })}</pre>
        </div>
      ) : null}

      <footer className="print-muted">{t("print.footer")}</footer>
    </section>
  );
}
