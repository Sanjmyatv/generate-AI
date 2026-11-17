"use client";

import { useState } from "react";
import { useLocale, useT } from "@/components/I18nProvider";
import { Reveal } from "@/components/Reveal";
import { TemplateCard } from "@/components/TemplateCard";
import { categoryName } from "@/lib/i18n/content";
import type { Category, Template } from "@/types";

export type DiscoveryTab = "all" | "video" | "image" | "trending";

/**
 * Design: zyro Home → Templates. One glass pill of filters (All, Videos, Images, Trending while real use fills it,
 * then one per category) over a grid of template tiles. A template shows under every category it belongs to.
 */
export function Discovery({
  templates,
  categories,
  trending: trendingInfo,
  initialTab,
}: {
  templates: Template[];
  categories: Category[];
  /** Null while too few templates qualify: the Trending filter is hidden. */
  trending: { label: string; ids: string[] } | null;
  initialTab: DiscoveryTab;
}) {
  const t = useT();
  const locale = useLocale();
  const [selected, setSelected] = useState<string>(initialTab);

  const order = new Map((trendingInfo?.ids ?? []).map((id, i) => [id, i]));
  const trending = templates.filter((x) => order.has(x.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  const usedCategories = categories.filter((c) => templates.some((x) => x.categoryIds.includes(c.id)));

  const tabs = [
    { id: "all", label: t("disc.all") },
    { id: "video", label: t("disc.videos") },
    { id: "image", label: t("disc.images") },
    ...(trending.length > 0 ? [{ id: "trending", label: trendingInfo?.label ?? t("disc.trendingChip") }] : []),
    ...usedCategories.map((c) => ({ id: `c:${c.id}`, label: categoryName(t, c, locale) })),
  ];
  const active = tabs.some((tab) => tab.id === selected) ? selected : "all";

  const items =
    active === "all"
      ? templates
      : active === "video" || active === "image"
        ? templates.filter((x) => x.type === active)
        : active === "trending"
          ? trending
          : templates.filter((x) => x.categoryIds.includes(active.slice(2)));

  const empty = active === "video" ? t("disc.emptyVideo") : active === "image" ? t("disc.emptyImage") : t("disc.empty");

  return (
    <section id="discover" className="flex flex-col gap-7 pb-[clamp(64px,10vw,104px)]">
      <Reveal className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-2">
          <h2 className="text-[clamp(30px,3.6vw,46px)] font-bold tracking-[-0.035em]">{t("disc.title")}</h2>
          <p className="text-[16px] font-light text-foreground/62">{t("disc.subtitle")}</p>
        </div>
        <div
          role="group"
          aria-label={t("disc.filterLabel")}
          className="no-scrollbar flex max-w-full overflow-x-auto rounded-full border border-white/12 bg-white/6 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] backdrop-blur-[24px]"
        >
          {tabs.map((tab) => {
            const on = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={on}
                onClick={() => setSelected(tab.id)}
                className={`flex-none whitespace-nowrap rounded-full px-[clamp(12px,3vw,18px)] py-2.5 text-[14px] font-medium transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${
                  on ? "chip-brand" : "text-foreground/62 hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </Reveal>

      {items.length === 0 ? (
        <p className="py-20 text-center text-[14px] text-muted">{empty}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(clamp(148px,40vw,220px),1fr))] gap-[clamp(10px,2.5vw,18px)]">
          {items.map((template, i) => (
            // Keyed by filter too, so switching filters plays the reveal again.
            <Reveal key={`${active}-${template.id}`} delay={(i % 4) * 90}>
              <TemplateCard template={template} />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  );
}
