import type { en } from "@/lib/i18n/messages/en";

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

type PluralBase<K> = K extends `${infer B}_one` | `${infer B}_other` ? B : never;
/** A key in the dictionary, or the base of a `_one` / `_other` pair (picked by `count`). */
export type TKey = MessageKey | PluralBase<MessageKey>;
export type Vars = Record<string, string | number>;

export interface T {
  (key: TKey, vars?: Vars): string;
  /** True when the dictionary has this exact key (for optional translations such as category names). */
  has: (key: string) => boolean;
}

/**
 * Builds the `t` function for one language. `{name}` placeholders are filled from `vars`; with a
 * numeric `count`, `key_one` is used for 1 and `key_other` for everything else. A missing key
 * shows the key itself, so a gap is visible on the page instead of crashing it.
 */
export function makeT(messages: Messages): T {
  const dict = messages as Record<string, string>;
  const t = ((key: TKey, vars?: Vars) => {
    let template: string | undefined;
    if (vars && typeof vars.count === "number") template = dict[`${key}${vars.count === 1 ? "_one" : "_other"}`];
    template ??= dict[key];
    if (template === undefined) return key;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? `{${name}}`));
  }) as T;
  t.has = (key) => key in dict;
  return t;
}
