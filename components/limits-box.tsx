"use client";

import { InfoIcon } from "lucide-react";
import { useLang } from "@/components/lang-provider";

/**
 * The honest-limits box (SPEC.md §2). It must be visible on the landing page and
 * on the results screen, and it must never be hidden behind a disclosure.
 */
export function LimitsBox() {
  const { t } = useLang();

  return (
    <aside
      className="rounded-xl border border-status-unverifiable-border bg-status-unverifiable-bg p-4 text-sm"
      aria-labelledby="limits-title"
    >
      <h2 id="limits-title" className="flex items-center gap-2 font-semibold text-foreground">
        <InfoIcon aria-hidden className="size-4" />
        {t("limits.title")}
      </h2>
      <p className="mt-2 text-muted-foreground">{t("limits.body")}</p>
      <ul className="mt-2 space-y-1.5 text-muted-foreground">
        <li className="flex gap-2">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-current" />
          <span>{t("limits.item1")}</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-current" />
          <span>{t("limits.item2")}</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-current" />
          <span>{t("limits.item3")}</span>
        </li>
      </ul>
    </aside>
  );
}
