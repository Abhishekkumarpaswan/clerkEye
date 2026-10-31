"use client";

import { useId } from "react";
import { BriefcaseIcon, MapPinIcon, Volume2Icon, WrenchIcon, SquareIcon } from "lucide-react";
import { useLang, useSpeechLang } from "@/components/lang-provider";
import { StatusChip } from "@/components/status-chip";
import { useSpeech } from "@/components/use-speech";
import { Button } from "@/components/ui/button";
import { ruleLabel } from "@/lib/i18n";
import { remedyForFinding, remedyKeys } from "@/lib/remedies/remedies";
import type { Explanation } from "@/lib/explain/templates";
import type { Finding } from "@/lib/rules/types";

/**
 * Fix card (SPEC.md §12.2, DESIGN.md): three short lines — what to fix, where to
 * go, what to carry — plus the explanation and a Listen button.
 *
 * The "check what your office accepts" line is not optional: no remedy has been
 * human-reviewed in v1.
 */
export function FixCard({
  finding,
  explanation,
  explanationLanguage,
}: {
  finding: Finding;
  explanation: Explanation | null;
  explanationLanguage: "en" | "hi";
}) {
  const { lang, t } = useLang();
  const speechLang = useSpeechLang();
  const { speakingKey, speak, stop, unavailableNotice } = useSpeech(
    speechLang,
    t("fix.voiceUnavailable"),
  );

  const remedy = remedyForFinding(finding);
  const keys = remedy ? remedyKeys(remedy) : null;
  const headingId = useId();
  const speakKey = `fix-${finding.rowKey}`;

  const explanationText = explanation?.text ?? "";
  const speechText =
    explanationLanguage === lang
      ? explanationText
      : explanationText; // explanation is regenerated on language change upstream

  return (
    <article
      className="rounded-xl border bg-card p-4"
      aria-labelledby={headingId}
      data-status={finding.status}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={finding.status} />
        {finding.source && !finding.source.verified ? (
          <span className="rounded-full border border-status-unverifiable-border bg-status-unverifiable-bg px-2 py-0.5 text-xs font-medium text-status-unverifiable">
            {t("results.unverifiedRule")}
          </span>
        ) : null}
      </div>

      <h3 id={headingId} className="mt-2 font-semibold leading-snug">
        {ruleLabel(lang, finding.ruleId, finding.check)}
      </h3>

      {finding.howToCheck ? (
        <div className="mt-2 rounded-lg bg-status-unverifiable-bg p-3 text-sm">
          <p className="font-medium">{t("detail.howToCheck")}</p>
          <p className="mt-1 text-muted-foreground">{finding.howToCheck}</p>
        </div>
      ) : null}

      {keys && finding.status !== "MATCH" ? (
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="flex w-24 shrink-0 items-start gap-1.5 text-muted-foreground">
              <WrenchIcon aria-hidden className="mt-0.5 size-4" />
              <span>{t("fix.what")}</span>
            </dt>
            <dd>{t(keys.what)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="flex w-24 shrink-0 items-start gap-1.5 text-muted-foreground">
              <MapPinIcon aria-hidden className="mt-0.5 size-4" />
              <span>{t("fix.where")}</span>
            </dt>
            <dd>{t(keys.where)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="flex w-24 shrink-0 items-start gap-1.5 text-muted-foreground">
              <BriefcaseIcon aria-hidden className="mt-0.5 size-4" />
              <span>{t("fix.carry")}</span>
            </dt>
            <dd>{t(keys.carry)}</dd>
          </div>
        </dl>
      ) : null}

      {explanationText ? (
        <div className="mt-3 rounded-lg border bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">{t("fix.explanation")}</p>
          <p className="mt-1 text-sm" lang={explanationLanguage}>
            {explanationText}
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {explanationText ? (
          speakingKey === speakKey ? (
            <Button variant="outline" size="sm" onClick={stop}>
              <SquareIcon aria-hidden />
              {t("fix.stop")}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => speak(speakKey, speechText)}
              aria-label={`${t("fix.listen")}: ${ruleLabel(lang, finding.ruleId, finding.check)}`}
            >
              <Volume2Icon aria-hidden />
              {t("fix.listen")}
            </Button>
          )
        ) : null}
      </div>

      {unavailableNotice ? (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          {unavailableNotice}
        </p>
      ) : null}

      <p className="mt-2 text-xs text-muted-foreground">{t("fix.reviewedNote")}</p>
    </article>
  );
}
