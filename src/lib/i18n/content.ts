import type { Locale } from "@/lib/i18n/config";
import type { T, TKey } from "@/lib/i18n/translate";

/** The template's name in the visitor's language; without a Mongolian one, the English name. */
export function templateName(template: { name: string; nameMn?: string | null }, locale: Locale) {
  return (locale === "mn" && template.nameMn?.trim()) || template.name;
}

export function templateDescription(template: { description: string; descriptionMn?: string | null }, locale: Locale) {
  return (locale === "mn" && template.descriptionMn?.trim()) || template.description;
}

/** A category's name: translated when the dictionary knows its id, otherwise as stored. */
export function categoryName(t: T, category: { id: string; name: string }) {
  const key = `category.${category.id}`;
  return t.has(key) ? t(key as TKey) : category.name;
}
