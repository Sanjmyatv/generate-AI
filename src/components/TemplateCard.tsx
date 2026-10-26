"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { formatCredits } from "@/config/pricing";
import type { Template } from "@/types";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/**
 * Figma: zyro.ai / Video template card and Image template card. The whole card opens the
 * template; "Use Template" is always visible and turns purple on hover, where a video
 * preview also starts playing.
 */
export function TemplateCard({ template }: { template: Template }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hover, setHover] = useState(false);

  const isVideo = template.type === "video";
  const src = template.previewUrl;
  const previewIsVideo = Boolean(src && VIDEO_EXT.test(src));
  const photos = template.requiredPhotoCount;
  const credits = `${formatCredits(template.creditCost)} ${template.creditCost === 1 ? "credit" : "credits"}`;

  function setHovering(next: boolean) {
    setHover(next);
    const video = videoRef.current;
    if (!video) return;
    if (next) {
      void video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0.1;
    }
  }

  return (
    <Link
      href={`/templates/${template.id}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
      className="flex w-[191px] shrink-0 snap-start flex-col gap-3 md:w-[227px] lg:w-[246px]"
    >
      <div
        className={`relative w-full overflow-hidden rounded-2xl border ${
          isVideo ? "aspect-[246/437.33]" : "aspect-[246/307.5]"
        } ${hover ? "border-purple ring-1 ring-purple" : "border-line"}`}
      >
        {src ? (
          previewIsVideo ? (
            <video
              ref={videoRef}
              // "#t=0.1" makes browsers paint a real frame instead of a black box before play.
              src={`${src}#t=0.1`}
              aria-label={template.name}
              muted
              loop
              playsInline
              preload="metadata"
              className="absolute inset-0 size-full bg-black object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={template.name} loading="lazy" className="absolute inset-0 size-full object-cover" />
          )
        ) : (
          <div
            role="img"
            aria-label={template.name}
            className="absolute inset-0 bg-[linear-gradient(135deg,rgba(139,92,246,0.3),rgba(59,130,246,0.2))]"
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,7,17,0)_50%,rgba(7,7,17,0.85)_100%)]" />

        {template.trendingRank !== null && (
          <div className="absolute left-[11px] top-[11px] flex items-start gap-[5px] rounded-lg border border-line bg-[rgba(7,7,17,0.53)] px-[10px] py-[6px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/icon-flame.svg" alt="" className="size-[13px]" />
            <span className="text-[10px] font-medium leading-[1.5] text-foreground">TRENDING</span>
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
        <p className="text-[15px] font-medium leading-[1.5] text-foreground">{template.name}</p>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] leading-[1.5] text-muted">
            {isVideo ? "AI video" : "AI image"} · {photos} {photos === 1 ? "photo" : "photos"}
          </p>
          <span
            className={`flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-line px-[9px] text-[10px] font-medium leading-[1.5] text-foreground ${
              hover ? "bg-purple" : "bg-surface"
            }`}
          >
            Use Template
          </span>
        </div>
      </div>
    </Link>
  );
}
