"use client";

import { useRef, useState } from "react";
import { FeaturedTemplate } from "@/components/home/FeaturedTemplate";
import { useLocale, useT } from "@/components/I18nProvider";
import { Reveal } from "@/components/Reveal";
import { TemplateCard } from "@/components/TemplateCard";
import { categoryName } from "@/lib/i18n/content";
import type { Category, Template } from "@/types";

export type Media = "video" | "image";

/** A scrolling row of template cards with its arrows (Figma: Row header + Template carousel). */
function TemplateRow({
  id,
  title,
  subtitle,
  templates,
}: {
  id?: string;
  title: string;
  subtitle: string;
  templates: Template[];
}) {
  const t = useT();
  const scroller = useRef<HTMLDivElement>(null);

  function scrollBy(direction: -1 | 1) {
    const el = scroller.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <Reveal as="section" id={id} className="flex flex-col gap-[22px] pb-3 pt-11">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-[6px] leading-[1.5]">
          <h2 className="text-[22px] text-foreground md:text-[26px]">{title}</h2>
          <p className="text-[14px] text-muted">{subtitle}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {([-1, 1] as const).map((direction) => (
            <button
              key={direction}
              type="button"
              aria-label={direction === -1 ? t("disc.scrollLeft", { title }) : t("disc.scrollRight", { title })}
              onClick={() => scrollBy(direction)}
              className="flex size-[38px] items-center justify-center rounded-full border border-line bg-surface"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={direction === -1 ? "/brand/icon-chevron-left.svg" : "/brand/icon-chevron-right.svg"}
                alt=""
                className="size-4"
              />
            </button>
          ))}
        </div>
      </div>
      <div
        ref={scroller}
        // Runs to the screen edges while the first card lines up with the page content.
        className="no-scrollbar -mx-5 flex snap-x gap-5 overflow-x-auto px-5 md:-mx-8 md:px-8 lg:-mx-16 lg:px-16"
      >
        {templates.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>
    </Reveal>
  );
}

const MEDIA_OPTIONS = [
  { value: "video", label: "disc.videos", icon: "/brand/icon-clapperboard.svg" },
  { value: "image", label: "disc.images", icon: "/brand/icon-image.svg" },
] as const;

const ALL = "all";
const TRENDING = "trending";

/**
 * Videos/Images switch, then chips: "Бүгд" (every template once), Trending (only while real use fills it) and one
 * chip per category. A template shows under every category it belongs to, but "Бүгд" lists it a single time.
 */
export function Discovery({
  templates,
  categories,
  trending: trendingInfo,
  initialMedia,
}: {
  templates: Template[];
  categories: Category[];
  /** Null while too few templates qualify: the chip and the section are hidden. */
  trending: { label: string; ids: string[] } | null;
  initialMedia: Media;
}) {
  const t = useT();
  const locale = useLocale();
  const [media, setMedia] = useState<Media>(initialMedia);
  const [selected, setSelected] = useState(ALL);

  const inMedia = templates.filter((t) => t.type === media);
  const order = new Map((trendingInfo?.ids ?? []).map((id, i) => [id, i]));
  const trending = inMedia.filter((t) => order.has(t.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  const rows = categories
    .map((category) => ({ category, templates: inMedia.filter((t) => t.categoryIds.includes(category.id)) }))
    .filter((row) => row.templates.length > 0);

  // A chip chosen under one media type may not exist under the other.
  const chipExists = (id: string) => id === ALL || (id === TRENDING && trending.length > 0) || rows.some((r) => r.category.id === id);
  const active = chipExists(selected) ? selected : ALL;
  const showAll = active === ALL;
  const featured = showAll ? trending[0] : undefined;
  const chips = [
    { id: ALL, label: t("disc.all") },
    ...(trending.length > 0 ? [{ id: TRENDING, label: trendingInfo?.label ?? t("disc.trendingChip") }] : []),
    ...rows.map((r) => ({ id: r.category.id, label: categoryName(t, r.category, locale) })),
  ];

  return (
    <div id="discover">
      <div className="flex flex-col gap-[26px] pb-3 pt-16">
        <div className="flex flex-col gap-3">
          <h2 className="text-[30px] leading-[1.15] tracking-[-1.4px] text-foreground md:text-[40px]">
            {t("disc.title")}
          </h2>
          <p className="text-[14px] leading-[1.5] text-muted md:text-[16px]">
            {t("disc.subtitle")}
          </p>
          <div className="pt-[10px]">
            <div
              role="group"
              aria-label={t("disc.typeLabel")}
              className="inline-flex gap-1 rounded-full border border-line bg-surface p-[5px]"
            >
              {MEDIA_OPTIONS.map((option) => {
                const on = media === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setMedia(option.value)}
                    className={`flex h-[46px] w-[145px] items-center justify-center gap-[9px] rounded-full border text-[14px] font-medium ${
                      on ? "border-line bg-[rgba(255,255,255,0.07)] text-foreground" : "border-transparent text-muted"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={option.icon} alt="" className="size-[18px]" />
                    {t(option.label)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          role="group"
          aria-label={t("disc.categories")}
          className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:-mx-8 md:px-8 lg:-mx-16 lg:px-16"
        >
          {chips.map((chip) => {
            const on = chip.id === active;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={on}
                onClick={() => setSelected(chip.id)}
                className={`h-11 shrink-0 whitespace-nowrap rounded-full border px-[18px] text-[13px] ${
                  on
                    ? "chip-brand border-transparent"
                    : "border-line bg-surface text-muted"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {inMedia.length === 0 ? (
        <p className="py-20 text-center text-[14px] text-muted">
          {media === "video" ? t("disc.emptyVideo") : t("disc.emptyImage")}
        </p>
      ) : (
        <>
          {(showAll || active === TRENDING) && trending.length > 0 && (
            <>
              <TemplateRow
                id="trending"
                title={trendingInfo?.label ?? t("disc.trendingTitle")}
                subtitle={t("disc.trendingSub")}
                templates={trending}
              />
              {featured && <FeaturedTemplate template={featured} />}
            </>
          )}
          {showAll && (
            <TemplateRow title={t("disc.allTitle")} subtitle={t("disc.count", { count: inMedia.length })} templates={inMedia} />
          )}
          {rows
            .filter((r) => r.category.id === active)
            .map(({ category, templates: items }) => (
              <TemplateRow
                key={category.id}
                title={categoryName(t, category, locale)}
                subtitle={t("disc.count", { count: items.length })}
                templates={items}
              />
            ))}
        </>
      )}
    </div>
  );
}
