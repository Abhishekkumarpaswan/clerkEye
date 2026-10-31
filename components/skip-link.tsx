"use client";

import { useLang } from "@/components/lang-provider";

export function SkipLink() {
  const { t } = useLang();
  return (
    <a href="#main" className="skip-link">
      {t("a11y.skipToContent")}
    </a>
  );
}
