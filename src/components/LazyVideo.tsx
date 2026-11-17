"use client";

import { useEffect, useRef, useState } from "react";

/** Phones and browsers can ask sites to save data; videos are then never loaded on their own. */
function saveDataOn() {
  const connection = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/**
 * A preview video that costs nothing until it is needed. A page full of templates would otherwise download every
 * video at once (megabytes each), which freezes phones and burns mobile data. This renders the picture (the poster)
 * or a placeholder, and only mounts the real <video> while the card is on or just next to the screen, and, when there
 * is a poster, only while it is actually playing (hover or focus). Scrolling away unmounts the video, which stops its
 * download. With the browser's data-saver on, no video is loaded at all.
 */
export function LazyVideo({
  src,
  poster,
  label,
  playing = false,
  controls = false,
  fill = false,
  className = "",
}: {
  src: string;
  /** A small still image of the video (see the thumbnail made when a preview is uploaded). */
  poster?: string | null;
  label: string;
  /** Plays while true (hover, focus, or always for a hero). */
  playing?: boolean;
  controls?: boolean;
  /** Fill the positioned box it sits in (absolute, inset 0) instead of taking its own size. */
  fill?: boolean;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting && !saveDataOn()), { rootMargin: "200px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // With a poster the video is only worth loading to play it; without one it loads to show its first frame.
  const mounted = near && (poster ? playing || controls : true);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (playing) void v.play().catch(() => {});
    else {
      v.pause();
      if (v.readyState > 0) v.currentTime = 0.1;
    }
  }, [playing, mounted]);

  return (
    <div ref={box} className={`${fill ? "absolute inset-0" : "relative"} overflow-hidden bg-brand/25 ${className}`}>
      {poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={poster} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      )}
      {mounted && (
        <video
          ref={video}
          // "#t=0.1" makes browsers paint a real frame instead of a black box before play.
          src={`${src}#t=0.1`}
          aria-label={label}
          muted
          loop
          playsInline
          autoPlay={playing}
          controls={controls}
          preload="metadata"
          className="absolute inset-0 size-full bg-black object-cover"
        />
      )}
    </div>
  );
}
