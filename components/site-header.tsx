"use client";

import Link from "next/link";
import { ScanEyeIcon } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { LangToggle } from "@/components/lang-toggle";

/** Shared header: wordmark, one-line promise, language toggle. */
export function SiteHeader({ showHome = true }: { showHome?: boolean }) {
  const { t } = useLang();

  return (
    <header className="border-b bg-card/60 print:hidden">
      <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3 px-5 py-3">
        <div className="min-w-0">
          {showHome ? (
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-md font-semibold"
              aria-label={t("app.name")}
            >
              <ScanEyeIcon aria-hidden className="size-5 text-primary" />
              <span>{t("app.name")}</span>
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2 font-semibold">
              <ScanEyeIcon aria-hidden className="size-5 text-primary" />
              <span>{t("app.name")}</span>
            </span>
          )}
          <p className="truncate text-xs text-muted-foreground">{t("app.tagline")}</p>
        </div>
        <LangToggle />
      </div>
    </header>
  );
}
