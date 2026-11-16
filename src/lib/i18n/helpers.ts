import type { Locale } from "@/lib/i18n/config";
import type { T, TKey } from "@/lib/i18n/translate";

/**
 * The pack's name in the visitor's language. Mongolian uses the name edited in /admin/packs, then the
 * dictionary; English uses the pack's own name. A pack added later keeps its own name.
 */
export function packName(t: T, pack: { id: string; name: string; nameMn?: string | null }, locale: Locale) {
  if (locale !== "mn") return pack.name;
  if (pack.nameMn) return pack.nameMn;
  const key = `pack.${pack.id}`;
  return t.has(key) ? t(key as TKey) : pack.name;
}
