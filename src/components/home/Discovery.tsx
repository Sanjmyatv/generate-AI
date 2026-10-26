"use client";

import { useRef, useState } from "react";
import { FeaturedTemplate } from "@/components/home/FeaturedTemplate";
import { TemplateCard } from "@/components/TemplateCard";
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
  const scroller = useRef<HTMLDivElement>(null);

  function scrollBy(direction: -1 | 1) {
    const el = scroller.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <section id={id} className="flex flex-col gap-[22px] pb-3 pt-11">
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
              aria-label={direction === -1 ? `Scroll ${title} left` : `Scroll ${title} right`}
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
    </section>
  );
}

const MEDIA_OPTIONS: { value: Media; label: string; icon: string }[] = [
  { value: "video", label: "Videos", icon: "/brand/icon-clapperboard.svg" },
  { value: "image", label: "Images", icon: "/brand/icon-image.svg" },
];

/**
 * Figma: Video template discovery. Videos/Images switch, category chips, a "Trending Now"
 * row, the featured template and one row per category. "Trending" shows everything; a
 * category chip narrows the page to that category.
 */
export function Discovery({
  templates,
  categories,
  initialMedia,
}: {
  templates: Template[];
  categories: Category[];
  initialMedia: Media;
}) {
  const [media, setMedia] = useState<Media>(initialMedia);
  const [selected, setSelected] = useState("trending");

  const inMedia = templates.filter((t) => t.type === media);
  const trending = inMedia
    .filter((t) => t.trendingRank !== null)
    .sort((a, b) => (a.trendingRank ?? 0) - (b.trendingRank ?? 0));
  const rows = categories
    .filter((c) => c.id !== "trending")
    .map((category) => ({ category, templates: inMedia.filter((t) => t.categoryId === category.id) }))
    .filter((row) => row.templates.length > 0);

  // A chip chosen under one media type may not exist under the other.
  const active = selected === "trending" || rows.some((r) => r.category.id === selected) ? selected : "trending";
  const showAll = active === "trending";
  const visibleRows = showAll ? rows : rows.filter((r) => r.category.id === active);
  const featured = trending[0];

  return (
    <div id="discover">
      <div className="flex flex-col gap-[26px] pb-3 pt-16">
        <div className="flex flex-col gap-3">
          <h2 className="text-[30px] leading-[1.15] tracking-[-1.4px] text-foreground md:text-[40px]">
            Create something incredible.
          </h2>
          <p className="text-[14px] leading-[1.5] text-muted md:text-[16px]">
            Pick a template. Upload your photo. Get a result worth sharing.
          </p>
          <div className="pt-[10px]">
            <div
              role="group"
              aria-label="Template type"
              className="inline-flex gap-1 rounded-2xl border border-line bg-surface p-[5px]"
            >
              {MEDIA_OPTIONS.map((option) => {
                const on = media === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setMedia(option.value)}
                    className={`flex h-[46px] w-[145px] items-center justify-center gap-[9px] rounded-[11px] border text-[14px] font-medium ${
                      on ? "border-line bg-[rgba(255,255,255,0.07)] text-foreground" : "border-transparent text-muted"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={option.icon} alt="" className="size-[18px]" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          role="group"
          aria-label="Categories"
          className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:-mx-8 md:px-8 lg:-mx-16 lg:px-16"
        >
          {[{ id: "trending", name: "Trending" }, ...rows.map((r) => r.category)].map((chip) => {
            const on = chip.id === active;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={on}
                onClick={() => setSelected(chip.id)}
                className={`h-11 shrink-0 whitespace-nowrap rounded-full border px-[18px] text-[13px] ${
                  on
                    ? "border-[rgba(139,92,246,0.5)] bg-[rgba(139,92,246,0.13)] text-purple-soft"
                    : "border-line bg-surface text-muted"
                }`}
              >
                {chip.name}
              </button>
            );
          })}
        </div>
      </div>

      {inMedia.length === 0 ? (
        <p className="py-20 text-center text-[14px] text-muted">
          No {media === "video" ? "video" : "image"} templates yet. Check back soon.
        </p>
      ) : (
        <>
          {showAll && trending.length > 0 && (
            <>
              <TemplateRow
                id="trending"
                title="Trending Now"
                subtitle="The templates everyone’s making their own."
                templates={trending}
              />
              {featured && <FeaturedTemplate template={featured} />}
            </>
          )}
          {visibleRows.map(({ category, templates: items }) => (
            <TemplateRow
              key={category.id}
              title={category.name}
              subtitle={`${items.length} ${items.length === 1 ? "template" : "templates"}`}
              templates={items}
            />
          ))}
        </>
      )}
    </div>
  );
}
