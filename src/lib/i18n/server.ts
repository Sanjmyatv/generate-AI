import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n/config";
import { MESSAGES } from "@/lib/i18n/messages";
import { makeT } from "@/lib/i18n/translate";

/** The visitor's saved language, otherwise the default (Mongolian). */
export async function getLocale(): Promise<Locale> {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(saved) ? saved : DEFAULT_LOCALE;
}

/** `t` for server components, pages and actions: `const { t, locale } = await getT();` */
export async function getT() {
  const locale = await getLocale();
  return { locale, t: makeT(MESSAGES[locale]) };
}
