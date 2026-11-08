export const LOCALES = ["en", "mn"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** The visitor's choice, kept for a year. Read on the server so the first paint is already in the right language. */
export const LOCALE_COOKIE = "locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Mongolian if the browser's first-choice language is Mongolian, otherwise English. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  const first = (header ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first === "mn" || first.startsWith("mn-") ? "mn" : DEFAULT_LOCALE;
}

/** BCP 47 tag for Intl formatting. */
export const INTL_LOCALE: Record<Locale, string> = { en: "en", mn: "mn" };
