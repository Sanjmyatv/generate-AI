import type { T, TKey } from "@/lib/i18n/translate";

/** The pack's name in the visitor's language; a pack added later in the database keeps its own name. */
export function packName(t: T, pack: { id: string; name: string }) {
  const key = `pack.${pack.id}`;
  return t.has(key) ? t(key as TKey) : pack.name;
}
