"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  FileSearchIcon,
  LoaderCircleIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { SiteHeader } from "@/components/site-header";
import { LimitsBox } from "@/components/limits-box";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/**
 * Landing page (SPEC.md §15).
 *
 * One-sentence value proposition, the limits box, a consent checkbox, and two
 * entry points: try the sample packet, or start with your own documents.
 * The consent tick is required before either button works — the sample path
 * included, so the demo teaches the same habit.
 */
export function Landing() {
  const { t } = useLang();
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [showConsentError, setShowConsentError] = useState(false);
  const [loading, setLoading] = useState(false);

  function go(target: string) {
    if (!consent) {
      setShowConsentError(true);
      return;
    }
    setLoading(true);
    router.push(target);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-[720px] flex-1 px-5 py-8">
        <h1 className="text-[1.6rem] font-semibold leading-tight text-balance sm:text-[1.9rem]">
          {t("landing.headline")}
        </h1>
        <p className="mt-3 text-muted-foreground">{t("landing.subhead")}</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            className="min-h-11 flex-1"
            onClick={() => go("/check?sample=1")}
            disabled={loading}
          >
            {loading ? (
              <LoaderCircleIcon aria-hidden className="animate-spin" />
            ) : (
              <FileSearchIcon aria-hidden />
            )}
            {t("landing.cta.sample")}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="min-h-11 flex-1"
            onClick={() => go("/check")}
            disabled={loading}
          >
            {t("landing.cta.start")}
            <ArrowRightIcon aria-hidden />
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{t("landing.sample.help")}</p>

        <div className="mt-6 rounded-xl border bg-card p-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="consent"
              checked={consent}
              onCheckedChange={(checked) => {
                setConsent(checked === true);
                if (checked === true) setShowConsentError(false);
              }}
              aria-describedby="consent-help"
              aria-invalid={showConsentError}
              className="mt-1"
            />
            <div>
              <Label htmlFor="consent" className="text-sm font-medium">
                {t("landing.consent.label")}
              </Label>
              <p id="consent-help" className="mt-1 text-sm text-muted-foreground">
                {t("landing.consent.help")}
              </p>
            </div>
          </div>
          {showConsentError ? (
            <p role="alert" className="mt-2 text-sm font-medium text-status-critical">
              {t("landing.consent.required")}
            </p>
          ) : null}
        </div>

        <div className="mt-8">
          <LimitsBox />
        </div>

        <section className="mt-8" aria-labelledby="how-title">
          <h2 id="how-title" className="text-lg font-semibold">
            {t("landing.how.title")}
          </h2>
          <ol className="mt-3 space-y-3">
            {["landing.how.step1", "landing.how.step2", "landing.how.step3"].map((key, index) => (
              <li key={key} className="flex gap-3">
                <span
                  aria-hidden
                  className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                >
                  {index + 1}
                </span>
                <span className="text-sm">{t(key)}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8" aria-labelledby="checks-title">
          <h2 id="checks-title" className="text-lg font-semibold">
            {t("landing.features.title")}
          </h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {[
              { icon: UsersIcon, key: "landing.features.names" },
              { icon: CalendarCheckIcon, key: "landing.features.dates" },
              { icon: FileSearchIcon, key: "landing.features.fixes" },
            ].map(({ icon: Icon, key }) => (
              <li key={key} className="rounded-lg border bg-card p-3 text-sm">
                <Icon aria-hidden className="mb-2 size-4 text-primary" />
                <p>{t(key)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 rounded-xl border bg-muted/40 p-4" aria-labelledby="privacy-title">
          <h2 id="privacy-title" className="flex items-center gap-2 text-base font-semibold">
            <ShieldCheckIcon aria-hidden className="size-4 text-primary" />
            {t("landing.privacy.title")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("landing.privacy.body")}</p>
        </section>

        <section className="mt-8 rounded-xl border bg-card p-4" aria-labelledby="built-title">
          <h2 id="built-title" className="text-base font-semibold">
            {t("landing.built.title")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("landing.built.body")}</p>
        </section>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Link href="/check?sample=1" className="underline underline-offset-2">
            {t("landing.cta.sample")}
          </Link>
        </p>
      </main>
    </div>
  );
}
