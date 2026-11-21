"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { useLocale, useT } from "@/components/I18nProvider";
import { LazyVideo } from "@/components/LazyVideo";
import { formatCredits } from "@/config/pricing";
import { templateName } from "@/lib/i18n/content";
import type { Template } from "@/types";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/** The template's own shape ("9:16", "16:9", …) as CSS; "auto" and anything unreadable fall back to 3:4. */
export function shapeOf(ratio: string) {
  const [w, h] = ratio.split(":").map(Number);
  return w > 0 && h > 0 ? { css: `${w} / ${h}`, wide: w > h, w, h } : { css: "3 / 4", wide: false, w: 3, h: 4 };
}

/**
 * Design: zyro Home → template tile. A tall glass frame that leans toward the pointer; the kind sits top-left, and a
 * glass panel at the bottom carries the name, length or photo count, and the price. A video preview plays on hover.
 */
export function TemplateCard({ template, className = "" }: { template: Template; className?: string }) {
  const t = useT();
  const name = templateName(template, useLocale());
  const [hover, setHover] = useState(false);

  const isVideo = template.type === "video";
  const src = template.previewUrl;
  const previewIsVideo = Boolean(src && VIDEO_EXT.test(src));
  const kind = isVideo ? t("card.kindVideo") : t("card.kindImage");
  const detail =
    isVideo && template.durationSeconds
      ? t("card.seconds", { count: template.durationSeconds })
      : t("card.photo", { count: template.requiredPhotoCount });
  const credits = t("card.credit", { count: Math.ceil(template.creditCost), amount: formatCredits(template.creditCost) });
  // The card takes the template's real shape, so a landscape video shows as landscape.
  const shape = shapeOf(template.aspectRatio);

  return (
    <Link
      href={`/templates/${template.id}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      data-tilt="12"
      style={{ aspectRatio: shape.css }}
      className={`glass-frame group @container block rounded-[26px] border-white/10 bg-white/6 p-[5px] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_20px_40px_rgba(0,0,0,0.35)] hover:border-brand-light/55 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_26px_60px_rgba(47,91,255,0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${className}`}
    >
      <div className="relative size-full overflow-hidden rounded-[21px] bg-brand/20">
        {src ? (
          previewIsVideo ? (
            // Loads only while on screen (and, with a thumbnail, only while hovered): see LazyVideo.
            <LazyVideo src={src} poster={template.posterUrl} label={name} playing={hover} fill />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={name} loading="lazy" className="absolute inset-0 size-full object-cover" />
          )
        ) : (
          <div role="img" aria-label={name} className="absolute inset-0" />
        )}
      </div>
      <div className="tilt-glow" style={{ "--glow-size": "260px" } as CSSProperties} />

      {/* A wide card is short on a phone: the badges only show from tablet width up. */}
      <div className={`pointer-events-none absolute left-4 top-4 gap-1.5 ${shape.wide ? "hidden sm:flex" : "flex"}`}>
        <span className="glass-chip rounded-full px-2.5 py-[5px] text-[11px] font-semibold">{kind}</span>
        {template.trending && (
          <span className="rounded-full bg-[linear-gradient(135deg,var(--brand-light),var(--brand))] px-2.5 py-[5px] text-[11px] font-semibold shadow-[0_0_14px_rgba(47,91,255,0.6)]">
            {t("card.trending")}
          </span>
        )}
      </div>

      {/* On a wide (landscape) card the panel is one slim line, so it does not cover the picture. */}
      <div
        className={`glass-chip pointer-events-none absolute inset-x-3 bottom-3 flex rounded-[18px] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] ${
          shape.wide ? "items-center justify-between gap-3 px-3 py-2" : "flex-col gap-1.5 px-3.5 py-3"
        }`}
      >
        <span className={`text-[14px] font-semibold leading-[1.25] ${shape.wide ? "truncate" : "line-clamp-2"}`}>{name}</span>
        <div className={`items-center justify-between gap-2 text-[12px] ${shape.wide ? "hidden shrink-0 sm:flex" : "flex"}`}>
          {!shape.wide && (
            // Only on a card wide enough to read it (narrow phone cards keep just the price).
            <span className="hidden truncate text-foreground/65 @[190px]:inline">
              {kind} · {detail}
            </span>
          )}
          <span className="shrink-0 font-semibold text-brand-light">{credits}</span>
        </div>
      </div>
    </Link>
  );
}
