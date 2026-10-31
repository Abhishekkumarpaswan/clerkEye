"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LANG_TAGS, translator, type Lang, type TFunction } from "@/lib/i18n";

/**
 * Language context.
 *
 * The chosen language lives in React state only — no localStorage, no cookie
 * (AGENTS.md rule 3). The default is English, and `<html lang>` is kept in sync
 * so screen readers and font fallback behave.
 */

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TFunction;
};

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({
  children,
  initialLang = "en",
}: {
  children: React.ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLang] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
  }, [lang]);

  const t = useMemo(() => translator(lang), [lang]);

  const value = useMemo<LangContextValue>(
    () => ({ lang, setLang, t }),
    [lang, t],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const context = useContext(LangContext);
  if (!context) {
    throw new Error("useLang must be used inside <LangProvider>");
  }
  return context;
}

/** Speech synthesis language tag for the current UI language. */
export function useSpeechLang(): string {
  const { lang } = useLang();
  return LANG_TAGS[lang];
}

/** Local helper so components can build stable aria ids. */
export function useUid(prefix: string): string {
  const [id] = useState(
    () => `${prefix}-${Math.random().toString(36).slice(2, 8)}`,
  );
  return useCallback(() => id, [id])();
}
