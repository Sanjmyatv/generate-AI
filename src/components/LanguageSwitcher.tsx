"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocaleAction } from "@/app/actions/locale";
import { useLocale, useT } from "@/components/I18nProvider";
import type { Locale } from "@/lib/i18n/config";

const OPTIONS: { locale: Locale; label: string; name: string }[] = [
  { locale: "en", label: "EN", name: "English" },
  { locale: "mn", label: "МН", name: "Монгол" },
];

/** English / Монгол switch for the top bar. Saves the choice in a cookie (server action) and re-renders the page in it. */
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
      className="flex h-9 items-center gap-0.5 rounded-full border border-white/15 bg-white/5 p-1 backdrop-blur-md sm:h-[42px]"
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
            className={`flex h-full min-w-8 items-center justify-center rounded-full px-2 text-[12px] sm:min-w-9 sm:px-2.5 font-semibold transition-colors duration-200 ${
              on
                ? "bg-linear-to-r from-violet-600 via-indigo-500 to-blue-500 text-white shadow-[0_0_14px_rgba(99,102,241,0.45)]"
                : "text-muted hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
