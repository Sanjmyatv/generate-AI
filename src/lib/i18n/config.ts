export const LOCALES = ["mn", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** Everyone starts in Mongolian; the switcher in the top bar changes it. */
export const DEFAULT_LOCALE: Locale = "mn";

/** The visitor's choice, kept for a year. Read on the server so the first paint is already in the right language. */
export const LOCALE_COOKIE = "locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** BCP 47 tag for Intl formatting. */
export const INTL_LOCALE: Record<Locale, string> = { en: "en", mn: "mn" };
