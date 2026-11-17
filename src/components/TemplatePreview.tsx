"use client";

import { useState } from "react";
import { LazyVideo } from "@/components/LazyVideo";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/**
 * Shows a template's preview: a muted looping video, an image, or a gradient
 * placeholder when none is set. Works with any template (previews are data, not code).
 */
export function TemplatePreview({
  src,
  poster,
  alt,
  className = "",
  mode = "card",
}: {
  src: string | null;
  /** A small still of the video, so a card does not have to download the video. */
  poster?: string | null;
  alt: string;
  className?: string;
  /**
   * "card": paused first frame, plays on hover/focus (cheap on pages with many templates).
   * "detail": autoplays muted in a loop.
   */
  mode?: "card" | "detail";
}) {
  const [hovering, setHovering] = useState(false);

  if (!src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`bg-brand/25 ${className}`}
      />
    );
  }

  if (!VIDEO_EXT.test(src)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={`object-cover ${className}`} />;
  }

  // The cards load their video only while on screen (and hovered when there is a thumbnail); the detail
  // page plays its one video, still only while it is on screen.
  return (
    <div
      className={`relative ${className}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <LazyVideo src={src} poster={poster} label={alt} playing={mode === "detail" || hovering} controls={mode === "detail"} fill />
    </div>
  );
}
