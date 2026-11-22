"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { useLocale, useT } from "@/components/I18nProvider";
import { LazyVideo } from "@/components/LazyVideo";
import { Reveal } from "@/components/Reveal";
import { shapeOf } from "@/components/TemplateCard";
import { formatCredits } from "@/config/pricing";
import { templateDescription, templateName } from "@/lib/i18n/content";
import type { Template } from "@/types";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
/** How long each template stays before the next one comes in. */
const TURN_MS = 7000;

function Media({ template, playing }: { template: Template; playing: boolean }) {
  const name = templateName(template, useLocale());
  const src = template.previewUrl;
  if (src && VIDEO_EXT.test(src)) return <LazyVideo src={src} poster={template.posterUrl} label={name} playing={playing} fill />;
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt={name} loading="lazy" className="absolute inset-0 size-full object-cover" />;
  return null;
}

/**
 * The home page's Trending section. The templates added in /admin ("Add to Trending"), video or image, take turns in
 * one big card with "Туршиж үзэх": each stays seven seconds (paused while the pointer is over the section), and the
 * thumbnails beside it show what is coming and jump straight to one.
 */
export function TrendingSpotlight({ templates, label }: { templates: Template[]; label: string }) {
  const t = useT();
  const locale = useLocale();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const current = templates[index % templates.length];
  const name = templateName(current, locale);
  const description = templateDescription(current, locale);
  const shape = shapeOf(current.aspectRatio);
  const isVideo = current.type === "video";
  const href = `/templates/${current.id}`;
  const many = templates.length > 1;

  const tags = [
    isVideo ? t("card.kindVideo") : t("card.kindImage"),
    isVideo && current.durationSeconds
      ? t("card.seconds", { count: current.durationSeconds })
      : t("card.photo", { count: current.requiredPhotoCount }),
    t("card.credit", { count: Math.ceil(current.creditCost), amount: formatCredits(current.creditCost) }),
  ];

  return (
    <section id="trending" className="scroll-mt-24 pb-[clamp(56px,8vw,96px)]">
      <Reveal className="relative overflow-hidden rounded-[32px] border border-white/12 bg-white/6 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_30px_80px_rgba(0,0,0,0.4)] backdrop-blur-[24px] sm:p-4 md:p-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full bg-[radial-gradient(circle,rgba(47,91,255,0.45),transparent_65%)] blur-2xl"
        />
        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className={`relative grid items-center gap-6 [--spot-h:min(118vw,560px)] [--spot-w:84vw] md:grid-cols-[auto_minmax(0,1fr)] md:gap-10 md:[--spot-h:clamp(400px,38vw,560px)] md:[--spot-w:40vw] lg:grid-cols-[auto_minmax(0,1fr)_auto] ${
            paused ? "spot-paused" : ""
          }`}
        >
          {/* Keyed by template, so each change fades in. Every card is as tall as the space allows in its own shape. */}
          <Link
            key={current.id}
            href={href}
            aria-label={name}
            data-tilt="6"
            className="spot-fade glass-frame relative mx-auto block max-w-full overflow-hidden rounded-[26px] p-[5px]"
            style={{ aspectRatio: shape.css, height: `min(var(--spot-h), calc(var(--spot-w) * ${(shape.h / shape.w).toFixed(4)}))` }}
          >
            <div className="relative size-full overflow-hidden rounded-[21px] bg-brand/20">
              <Media template={current} playing />
            </div>
            <div className="tilt-glow" />
          </Link>

          <div key={`${current.id}-text`} className="spot-fade flex min-w-0 flex-col items-start gap-4 px-2 md:gap-5 md:px-0">
            <span className="rounded-full bg-[linear-gradient(135deg,#ff9a3d,#ff4d4d)] px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-white shadow-[0_0_18px_rgba(255,110,60,0.55)]">
              🔥 {label}
              {many && <span className="ml-1.5 opacity-80">{index + 1}/{templates.length}</span>}
            </span>
            <h2 className="text-balance text-[clamp(28px,4vw,52px)] font-bold leading-[1.05] tracking-[-0.04em]">{name}</h2>
            {description && (
              <p className="line-clamp-3 max-w-[520px] text-pretty text-[16px] font-light leading-[1.6] text-foreground/70">{description}</p>
            )}
            <ul className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li key={tag} className="glass-chip rounded-full px-3 py-1.5 text-[13px] font-medium">
                  {tag}
                </li>
              ))}
            </ul>
            <Link href={href} data-mag="" className="btn-primary mt-1 max-md:w-full">
              {t("trend.try")} <span aria-hidden="true">→</span>
            </Link>
          </div>

          {many && (
            <div
              role="tablist"
              aria-label={label}
              className="no-scrollbar flex gap-3 overflow-x-auto px-2 pb-1 md:col-span-full md:px-0 lg:col-span-1 lg:max-w-[min(36vw,560px)] lg:pr-2"
            >
              {templates.map((item, i) => {
                const on = i === index;
                const itemName = templateName(item, locale);
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-label={itemName}
                    onClick={() => setIndex(i)}
                    // One tall shape for every thumbnail (the picture is cropped to fit), so a row of them stays tidy.
                    className={`relative aspect-[9/16] h-[150px] flex-none overflow-hidden rounded-2xl border-2 transition lg:h-[230px] ${
                      on ? "border-brand-light shadow-[0_0_24px_rgba(47,91,255,0.55)]" : "border-white/10 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <span className="absolute inset-0 bg-brand/20">
                      <Media template={item} playing={false} />
                    </span>
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-2.5 pt-6 text-left text-[12px] font-semibold leading-tight">
                      <span className="line-clamp-2">{itemName}</span>
                    </span>
                    {on && (
                      // Fills over TURN_MS, then the next template comes in.
                      <span className="absolute inset-x-2 bottom-1 h-[3px] overflow-hidden rounded-full bg-white/25">
                        <span
                          key={index}
                          className="spot-progress block h-full rounded-full bg-white"
                          style={{ "--spot-ms": `${TURN_MS}ms` } as CSSProperties}
                          onAnimationEnd={() => setIndex((n) => (n + 1) % templates.length)}
                        />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Reveal>
    </section>
  );
}
