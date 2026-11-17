"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocaleAction } from "@/app/actions/locale";
import { useLocale, useT } from "@/components/I18nProvider";
import type { Locale } from "@/lib/i18n/config";

const OPTIONS: { locale: Locale; label: string; name: string }[] = [
  { locale: "mn", label: "МН", name: "Монгол" },
  { locale: "en", label: "EN", name: "English" },
];

/** Монгол / English switch for the top bar. Saves the choice in a cookie (server action) and re-renders the page in it. */
export function LanguageSwitcher() {
  const current = useLocale();
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === current) return;
    startTransition(async () => {
      await setLocaleAction(locale);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={t("lang.label")}
      aria-busy={pending}
      className="flex items-center rounded-full border border-white/8 bg-black/30 p-[3px]"
    >
      {OPTIONS.map((option) => {
        const on = option.locale === current;
        return (
          <button
            key={option.locale}
            type="button"
            lang={option.locale}
            title={option.name}
            aria-pressed={on}
            onClick={() => choose(option.locale)}
            className={`flex min-h-8 min-w-9 items-center justify-center rounded-full px-[11px] py-1.5 text-[12px] font-semibold transition-all duration-200 ${
              on ? "bg-white/16 text-white" : "text-foreground/55 hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
