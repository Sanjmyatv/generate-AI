"use client";

import { useState, type ReactNode } from "react";
import { useLocale, useT } from "@/components/I18nProvider";
import { Reveal } from "@/components/Reveal";
import { TemplateCard } from "@/components/TemplateCard";
import { categoryName } from "@/lib/i18n/content";
import type { Category, Template } from "@/types";

/** Columns per screen size: 2 on phones, 3 on tablets, 4 on laptops, 5 on wide screens (see the grid below). */
const COLUMNS = { base: 2, sm: 3, lg: 4, xl: 5 };
const ROWS_COLLAPSED = 2;

/**
 * Cards in rows, each keeping its template's own shape. With `collapsed`, only the first two rows show at every
 * screen size (cards past that are hidden by CSS, so it is right before any script runs).
 */
function TemplateGrid({ items, filter, collapsed = false }: { items: Template[]; filter: string; collapsed?: boolean }) {
  const limit = (cols: number) => cols * ROWS_COLLAPSED;
  return (
    <div className="grid grid-cols-2 items-start gap-[clamp(8px,1.6vw,16px)] sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((template, i) => {
        const hide = collapsed
          ? [
              i >= limit(COLUMNS.base) ? "max-sm:hidden" : "",
              i >= limit(COLUMNS.sm) ? "sm:max-lg:hidden" : "",
              i >= limit(COLUMNS.lg) ? "lg:max-xl:hidden" : "",
              i >= limit(COLUMNS.xl) ? "xl:hidden" : "",
            ].join(" ")
          : "";
        return (
          // Keyed by filter too, so switching filters plays the reveal again.
          <Reveal key={`${filter}-${template.id}`} delay={(i % 5) * 80} className={hide}>
            <TemplateCard template={template} />
          </Reveal>
        );
      })}
    </div>
  );
}

/** "Бүгдийг харах": shown only at the screen sizes where some cards are hidden. */
function SeeAllButton({ count, onClick }: { count: number; onClick: () => void }) {
  const t = useT();
  const limit = (cols: number) => cols * ROWS_COLLAPSED;
  const visibility = [
    count > limit(COLUMNS.base) ? "max-sm:flex" : "max-sm:hidden",
    count > limit(COLUMNS.sm) ? "sm:max-lg:flex" : "sm:max-lg:hidden",
    count > limit(COLUMNS.lg) ? "lg:max-xl:flex" : "lg:max-xl:hidden",
    count > limit(COLUMNS.xl) ? "xl:flex" : "xl:hidden",
  ].join(" ");
  return (
    <div className={`justify-center pt-2 ${visibility}`}>
      <button type="button" onClick={onClick} className="btn-glass !px-7">
        {t("disc.seeAll", { count })} <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

function SectionHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <Reveal className="flex flex-wrap items-end justify-between gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-[clamp(30px,3.6vw,46px)] font-bold tracking-[-0.035em]">{title}</h2>
        <p className="text-[16px] font-light text-foreground/62">{subtitle}</p>
      </div>
      {children}
    </Reveal>
  );
}

/**
 * Design: zyro Home → templates, in two sections. Videos come first, with a glass pill of filters (All, Trending while
 * real use fills it, then one per category that has videos). Images follow as their own section, without filters.
 */
export function Discovery({
  templates,
  categories,
  trending: trendingInfo,
}: {
  templates: Template[];
  categories: Category[];
  /** Null while too few templates qualify: the Trending filter is hidden. */
  trending: { label: string; ids: string[] } | null;
}) {
  const t = useT();
  const locale = useLocale();
  const [selected, setSelected] = useState("all");
  // Videos show two rows until "Бүгдийг харах"; changing the filter folds them again.
  const [expanded, setExpanded] = useState(false);

  const videos = templates.filter((x) => x.type === "video");
  const images = templates.filter((x) => x.type === "image");

  const order = new Map((trendingInfo?.ids ?? []).map((id, i) => [id, i]));
  const trendingVideos = videos.filter((x) => order.has(x.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  // Only categories that have videos: an image-only category (such as "Зураг") never shows here.
  const videoCategories = categories.filter((c) => videos.some((x) => x.categoryIds.includes(c.id)));

  const tabs = [
    { id: "all", label: t("disc.all") },
    ...(trendingVideos.length > 0 ? [{ id: "trending", label: trendingInfo?.label ?? t("disc.trendingChip") }] : []),
    ...videoCategories.map((c) => ({ id: `c:${c.id}`, label: categoryName(t, c, locale) })),
  ];
  const active = tabs.some((tab) => tab.id === selected) ? selected : "all";
  const shownVideos =
    active === "all"
      ? videos
      : active === "trending"
        ? trendingVideos
        : videos.filter((x) => x.categoryIds.includes(active.slice(2)));

  return (
    <div id="discover" className="flex flex-col gap-[clamp(64px,10vw,104px)] pb-[clamp(64px,10vw,104px)]">
      <section id="videos" className="flex flex-col gap-7">
        <SectionHeader title={t("disc.videosTitle")} subtitle={t("disc.videosSub")}>
          {tabs.length > 1 && (
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
                    onClick={() => {
                      setSelected(tab.id);
                      setExpanded(false);
                    }}
                    className={`flex-none whitespace-nowrap rounded-full px-[clamp(12px,3vw,18px)] py-2.5 text-[14px] font-medium transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${
                      on ? "chip-brand" : "text-foreground/62 hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </SectionHeader>
        {shownVideos.length === 0 ? (
          <p className="py-16 text-center text-[14px] text-muted">{active === "all" ? t("disc.emptyVideo") : t("disc.empty")}</p>
        ) : (
          <>
            <TemplateGrid items={shownVideos} filter={active} collapsed={!expanded} />
            {!expanded && <SeeAllButton count={shownVideos.length} onClick={() => setExpanded(true)} />}
          </>
        )}
      </section>

      <section id="images" className="flex flex-col gap-7">
        <SectionHeader title={t("disc.imagesTitle")} subtitle={t("disc.imagesSub")} />
        {images.length === 0 ? (
          <p className="py-16 text-center text-[14px] text-muted">{t("disc.emptyImage")}</p>
        ) : (
          <TemplateGrid items={images} filter="images" />
        )}
      </section>
    </div>
  );
}
