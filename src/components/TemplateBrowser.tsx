"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useT } from "@/components/I18nProvider";
import { Reveal } from "@/components/Reveal";
import { TemplateCard } from "@/components/TemplateCard";
import { categoryName } from "@/lib/i18n/content";
import type { Category, Template } from "@/types";

const pill =
  "flex-none whitespace-nowrap rounded-full px-[clamp(12px,3vw,18px)] py-2.5 text-[14px] font-medium transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)]";
const pillGroup =
  "no-scrollbar flex max-w-full overflow-x-auto rounded-full border border-white/12 bg-white/6 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-[24px]";

/**
 * The full list behind "Бүгдийг харах": Video / Image tabs (links, so the address can be shared), then the filters
 * for that kind (All, Trending, and each category that narrows the list), and every matching template in a grid.
 */
export function TemplateBrowser({
  type,
  templates,
  categories,
  trending,
}: {
  type: "video" | "image";
  templates: Template[];
  categories: Category[];
  trending: { label: string; ids: string[] } | null;
}) {
  const t = useT();
  const locale = useLocale();
  const [selected, setSelected] = useState("all");

  const videos = templates.filter((x) => x.type === "video");
  const images = templates.filter((x) => x.type === "image");
  const items = type === "video" ? videos : images;

  const order = new Map((trending?.ids ?? []).map((id, i) => [id, i]));
  const trendingItems = items.filter((x) => order.has(x.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  // A category is a filter only if it narrows the list: one holding every template of this kind (such as "Зураг"
  // on the image tab) is left out.
  const itemCategories = categories.filter((c) => {
    const n = items.filter((x) => x.categoryIds.includes(c.id)).length;
    return n > 0 && n < items.length;
  });
  const filters = [
    { id: "all", label: t("disc.all") },
    ...(trendingItems.length > 0 ? [{ id: "trending", label: trending?.label ?? t("disc.trendingChip") }] : []),
    ...itemCategories.map((c) => ({ id: `c:${c.id}`, label: categoryName(t, c, locale) })),
  ];
  const active = filters.some((f) => f.id === selected) ? selected : "all";
  const shown =
    active === "all" ? items : active === "trending" ? trendingItems : items.filter((x) => x.categoryIds.includes(active.slice(2)));

  const tabs = [
    { type: "video" as const, label: t("disc.videosTitle"), count: videos.length },
    { type: "image" as const, label: t("disc.imagesTitle"), count: images.length },
  ];

  return (
    <div className="flex flex-col gap-6 pb-[clamp(64px,10vw,104px)] pt-[clamp(24px,5vw,56px)] sm:gap-8">
      <Reveal className="flex flex-col gap-5">
        <Link href="/" className="self-start text-[14px] text-foreground/62 transition hover:text-foreground">
          ← {t("all.back")}
        </Link>
        <h1 className="text-[clamp(32px,4.4vw,56px)] font-bold leading-none tracking-[-0.04em]">{t("all.title")}</h1>
        <nav aria-label={t("all.kindLabel")} className={`${pillGroup} self-start`}>
          {tabs.map((tab) => {
            const on = tab.type === type;
            return (
              <Link
                key={tab.type}
                href={`/templates?type=${tab.type}`}
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={`${pill} ${on ? "chip-brand" : "text-foreground/62 hover:text-foreground"}`}
              >
                {tab.label} <span className="opacity-60">{tab.count}</span>
              </Link>
            );
          })}
        </nav>
      </Reveal>

      {filters.length > 1 && (
        <Reveal>
          <div role="group" aria-label={t("disc.filterLabel")} className={`${pillGroup} w-fit`}>
            {filters.map((f) => {
              const on = f.id === active;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelected(f.id)}
                  className={`${pill} ${on ? "chip-brand" : "text-foreground/62 hover:text-foreground"}`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </Reveal>
      )}

      {shown.length === 0 ? (
        <p className="py-16 text-center text-[14px] text-muted">
          {active === "all" ? t(type === "video" ? "disc.emptyVideo" : "disc.emptyImage") : t("disc.empty")}
        </p>
      ) : (
        <div className="grid grid-cols-2 items-start gap-[clamp(8px,1.6vw,16px)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {shown.map((template, i) => (
            // Keyed by kind and filter too, so switching plays the reveal again.
            <Reveal key={`${type}-${active}-${template.id}`} delay={(i % 6) * 70}>
              <TemplateCard template={template} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
