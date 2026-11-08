"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/config";
import { makeT, type Messages, type T } from "@/lib/i18n/translate";

interface I18nValue {
  locale: Locale;
  t: T;
}

const I18nContext = createContext<I18nValue | null>(null);

/** Hands the visitor's language and its dictionary to every client component below it. */
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ locale, t: makeT(messages) }), [locale, messages]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useT must be used inside <I18nProvider>");
  return value;
}

/** `const t = useT();` in client components. */
export function useT() {
  return useI18n().t;
}

export function useLocale() {
  return useI18n().locale;
}
