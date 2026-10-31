"use client";

import { LanguagesIcon } from "lucide-react";
import { useLang } from "@/components/lang-provider";
import { LANGS, LANG_LABELS } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** English / हिंदी toggle. A segmented control, keyboard accessible. */
export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang, t } = useLang();

  return (
    <div
      className={cn("inline-flex items-center gap-1 rounded-full border bg-card p-1", className)}
      role="group"
      aria-label={t("lang.label")}
    >
      <LanguagesIcon aria-hidden className="ml-1 size-4 text-muted-foreground" />
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          className={cn(
            "min-h-9 rounded-full px-3 text-sm font-medium transition-colors",
            lang === code
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {LANG_LABELS[code]}
        </button>
      ))}
    </div>
  );
}
