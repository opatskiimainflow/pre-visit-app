"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { messages } from "./messages";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** Messages for client components (same dictionaries as the server). */
export function useT() {
  const locale = useContext(LocaleContext);
  return useMemo(() => ({ locale, t: messages(locale) }), [locale]);
}
