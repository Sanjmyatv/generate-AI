import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, isLocale, localeFromAcceptLanguage, type Locale } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";
import { makeT } from "@/lib/i18n/translate";

/** The visitor's language: their saved choice, else what their browser prefers. */
export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
}

/** `t` for server components, pages and actions: `const { t, locale } = await getT();` */
export async function getT() {
  const locale = await getLocale();
  return { locale, t: makeT(MESSAGES[locale]) };
}
