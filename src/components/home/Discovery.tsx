"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "@/components/I18nProvider";
import { Reveal } from "@/components/Reveal";
import { shapeOf, TemplateCard } from "@/components/TemplateCard";
import type { Template } from "@/types";

export function SectionHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <Reveal className="flex items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5 sm:gap-2">
        <h2 className="text-[clamp(26px,3.6vw,46px)] font-bold leading-tight tracking-[-0.035em]">{title}</h2>
        <p className="text-[14px] font-light text-foreground/62 sm:text-[16px]">{subtitle}</p>
      </div>
      {children}
    </Reveal>
  );
}

function Arrow({ dir, disabled, onClick, label }: { dir: -1 | 1; disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="hidden size-11 place-items-center rounded-full border border-white/14 bg-white/7 text-[18px] shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-[20px] transition hover:border-brand-light/60 hover:bg-white/13 disabled:pointer-events-none disabled:opacity-35 md:grid"
    >
      <span aria-hidden="true">{dir < 0 ? "←" : "→"}</span>
    </button>
  );
}

/**
 * One section of the home page: a title, "Бүгдийг харах" in the top-right corner (it opens the full list), and a
 * single row of cards that slides sideways (swipe on a phone; arrows or a trackpad on a computer). Every card in the
 * row has the same height and keeps its template's own shape, so portrait and landscape templates sit side by side.
 */
function TemplateSlider({
  id,
  title,
  subtitle,
  items,
  seeAllHref,
  empty,
}: {
  id: string;
  title: string;
  subtitle: string;
  items: Template[];
  seeAllHref: string;
  empty: string;
}) {
  const t = useT();
  const row = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = row.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = row.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const slide = (dir: -1 | 1) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-5 sm:gap-7">
      <SectionHeader title={title} subtitle={subtitle}>
        {items.length > 0 && (
          <div className="flex flex-none items-center gap-2">
            {/* Only when the row is wider than the screen. */}
            {!(edges.start && edges.end) && (
              <>
                <Arrow dir={-1} disabled={edges.start} onClick={() => slide(-1)} label={t("disc.prev")} />
                <Arrow dir={1} disabled={edges.end} onClick={() => slide(1)} label={t("disc.next")} />
              </>
            )}
            <Link href={seeAllHref} className="btn-primary btn-compact whitespace-nowrap">
              {t("disc.seeAll")} <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      </SectionHeader>
      {items.length === 0 ? (
        <p className="py-16 text-center text-[14px] text-muted">{empty}</p>
      ) : (
        <Reveal>
          {/* Runs to the screen's edges (past the page padding), so cards slide out of view instead of being cut. */}
          <div
            ref={row}
            onScroll={measure}
            className="no-scrollbar -mx-3 flex snap-x snap-mandatory gap-[clamp(10px,1.4vw,16px)] overflow-x-auto overscroll-x-contain scroll-px-3 px-3 py-3 [--row-h:clamp(260px,30vw,420px)] sm:-mx-4 sm:scroll-px-4 sm:px-4 md:-mx-6 md:scroll-px-6 md:px-6 lg:-mx-8 lg:scroll-px-8 lg:px-8"
          >
            {items.map((template) => {
              const shape = shapeOf(template.aspectRatio);
              return (
                <div
                  key={template.id}
                  className="flex-none snap-start"
                  // Same height for every card; a landscape card is kept narrower than the phone's screen.
                  style={{ aspectRatio: shape.css, height: `min(var(--row-h), ${((86 * shape.h) / shape.w).toFixed(2)}vw)` }}
                >
                  <TemplateCard template={template} className="size-full" />
                </div>
              );
            })}
          </div>
        </Reveal>
      )}
    </section>
  );
}

/** Design: zyro Home → templates. Videos, then images, each one sliding row with "Бүгдийг харах". */
export function Discovery({ templates }: { templates: Template[] }) {
  const t = useT();
  return (
    <div id="discover" className="flex scroll-mt-24 flex-col gap-[clamp(56px,8vw,96px)] pb-[clamp(64px,10vw,104px)]">
      <TemplateSlider
        id="videos"
        title={t("disc.videosTitle")}
        subtitle={t("disc.videosSub")}
        items={templates.filter((x) => x.type === "video")}
        seeAllHref="/templates?type=video"
        empty={t("disc.emptyVideo")}
      />
      <TemplateSlider
        id="images"
        title={t("disc.imagesTitle")}
        subtitle={t("disc.imagesSub")}
        items={templates.filter((x) => x.type === "image")}
        seeAllHref="/templates?type=image"
        empty={t("disc.emptyImage")}
      />
    </div>
  );
}
