"use client";

import { useRef } from "react";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/**
 * Shows a template's preview: a muted looping video, an image, or a gradient
 * placeholder when none is set. Works with any template (previews are data, not code).
 */
export function TemplatePreview({
  src,
  alt,
  className = "",
  mode = "card",
}: {
  src: string | null;
  alt: string;
  className?: string;
  /**
   * "card": paused first frame, plays on hover/focus (cheap on pages with many templates).
   * "detail": autoplays muted in a loop.
   */
  mode?: "card" | "detail";
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  if (!src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`bg-gradient-to-br from-violet-500/30 to-pink-500/30 ${className}`}
      />
    );
  }

  if (!VIDEO_EXT.test(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={`object-cover ${className}`} />;
  }

  const hover = mode === "card";
  return (
    <video
      ref={videoRef}
      // "#t=0.1" makes browsers paint a real frame instead of a black box before play.
      src={hover ? `${src}#t=0.1` : src}
      aria-label={alt}
      muted
      loop
      playsInline
      autoPlay={!hover}
      preload={hover ? "metadata" : "auto"}
      controls={!hover}
      className={`bg-black object-cover ${className}`}
      onMouseEnter={hover ? () => void videoRef.current?.play().catch(() => {}) : undefined}
      onMouseLeave={
        hover
          ? () => {
              const v = videoRef.current;
              if (v) {
                v.pause();
                v.currentTime = 0.1;
              }
            }
          : undefined
      }
    />
  );
}
