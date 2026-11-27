"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";

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
  sound = false,
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
  /** Show a sound on/off button. The video still starts muted (browsers block autoplay with sound). */
  sound?: boolean;
  className?: string;
}) {
  const t = useT();
  const [muted, setMuted] = useState(true);
  /** Whether the video has a sound track; the button only shows once it does (older previews were saved silent). */
  const [hasAudio, setHasAudio] = useState(false);
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

  // React does not keep the `muted` attribute in sync, so it is set on the element.
  useEffect(() => {
    if (video.current) video.current.muted = muted;
  }, [muted, mounted]);

  // Browsers say whether there is sound in different ways: Safari lists audio tracks, Firefox has mozHasAudio, and
  // Chrome counts decoded audio bytes once it has played a moment (it decodes even while muted).
  const checkAudio = () => {
    const v = video.current as
      | (HTMLVideoElement & { audioTracks?: { length: number }; mozHasAudio?: boolean; webkitAudioDecodedByteCount?: number })
      | null;
    if (!v || hasAudio) return;
    if ((v.audioTracks?.length ?? 0) > 0 || v.mozHasAudio || (v.webkitAudioDecodedByteCount ?? 0) > 0) setHasAudio(true);
  };

  const toggleSound = () => {
    const v = video.current;
    const next = !muted;
    setMuted(next);
    if (v) {
      v.muted = next;
      if (!next && v.paused) void v.play().catch(() => {});
    }
  };

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
          onLoadedMetadata={sound ? checkAudio : undefined}
          onTimeUpdate={sound && !hasAudio ? checkAudio : undefined}
          controls={controls}
          preload="metadata"
          className="absolute inset-0 size-full bg-black object-cover"
        />
      )}
      {sound && mounted && hasAudio && (
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={!muted}
          aria-label={muted ? t("video.soundOn") : t("video.soundOff")}
          className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-[12px] font-semibold text-white backdrop-blur-md transition hover:bg-black/70"
        >
          {muted ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4z" />
              <path d="m22 9-6 6M16 9l6 6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
            </svg>
          )}
          {muted ? t("video.soundOn") : t("video.soundOff")}
        </button>
      )}
    </div>
  );
}
