"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useT } from "@/components/I18nProvider";
import { LazyVideo } from "@/components/LazyVideo";
import { formatCredits } from "@/config/pricing";
import { templateName } from "@/lib/i18n/content";
import type { Template } from "@/types";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/**
 * Figma: zyro.ai / Video template card and Image template card. The whole card opens the
 * template; "Use Template" is always visible and turns purple on hover, where a video
 * preview also starts playing.
 */
export function TemplateCard({ template }: { template: Template }) {
  const t = useT();
  const name = templateName(template, useLocale());
  const [hover, setHover] = useState(false);

  const isVideo = template.type === "video";
  const src = template.previewUrl;
  const previewIsVideo = Boolean(src && VIDEO_EXT.test(src));
  const photos = template.requiredPhotoCount;
  const credits = t("card.credit", { count: Math.ceil(template.creditCost), amount: formatCredits(template.creditCost) });

  return (
    <Link
      href={`/templates/${template.id}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className="flex w-[191px] shrink-0 snap-start flex-col gap-3 md:w-[227px] lg:w-[246px]"
    >
      <div
        className={`relative w-full overflow-hidden rounded-2xl border ${
          isVideo ? "aspect-[246/437.33]" : "aspect-[246/307.5]"
        } ${hover ? "border-purple ring-1 ring-purple" : "border-line"}`}
      >
        {src ? (
          previewIsVideo ? (
            // Loads only while on screen (and, with a thumbnail, only while hovered): see LazyVideo.
            <LazyVideo src={src} poster={template.posterUrl} label={name} playing={hover} fill />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={name} loading="lazy" className="absolute inset-0 size-full object-cover" />
          )
        ) : (
          <div
            role="img"
            aria-label={name}
            className="absolute inset-0 bg-brand/25"
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,6,16,0)_50%,rgba(10,6,16,0.85)_100%)]" />

        {template.trending && (
          <div className="absolute left-[11px] top-[11px] flex items-start gap-[5px] rounded-lg border border-line bg-[rgba(10,6,16,0.53)] px-[10px] py-[6px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/icon-flame.svg" alt="" className="size-[13px]" />
            <span className="text-[10px] font-medium leading-[1.5] text-foreground">{t("card.trending")}</span>
          </div>
        )}

        <div className="absolute bottom-[11px] left-[11px] flex items-center gap-[5px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={isVideo ? "/brand/icon-play-card.svg" : "/brand/icon-sparkles-sm.svg"} alt="" className="size-[13px]" />
          <span className="text-[11px] leading-[1.5] text-foreground">{credits}</span>
        </div>

        {isVideo && hover && (
          <div className="absolute left-1/2 top-1/2 flex size-[54px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[rgba(255,255,255,0.13)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/icon-play-hover.svg" alt="" className="size-[22px]" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[15px] font-medium leading-[1.5] text-foreground">{name}</p>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] leading-[1.5] text-muted">
            {isVideo ? t("card.aiVideo") : t("card.aiImage")} · {t("card.photo", { count: photos })}
          </p>
          <span
            className={`flex min-h-8 shrink-0 items-center justify-center whitespace-nowrap px-3 text-[11px] leading-[1.5] ${
              hover ? "chip-brand" : "chip-glass font-medium"
            }`}
          >
            {t("card.use")}
          </span>
        </div>
      </div>
    </Link>
  );
}
