"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useT } from "@/components/I18nProvider";
import { useWatermark, withWatermark } from "@/components/WatermarkToggle";

/** The name the server gave the file (Content-Disposition), so a saved file keeps "zyro-<title>-<date>". */
function fileNameFrom(res: Response, fallback: string) {
  const header = res.headers.get("content-disposition") ?? "";
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
  if (utf8) {
    try {
      return decodeURIComponent(utf8);
    } catch {
      /* fall through */
    }
  }
  return /filename="([^"]+)"/i.exec(header)?.[1] ?? fallback;
}

const noSubscribe = () => () => {};

/** A phone or tablet whose browser can hand a file to the share sheet ("Save Video" / "Save Image" puts it in Photos). */
function canShareFiles() {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  if (!window.matchMedia("(pointer: coarse)").matches) return false;
  try {
    return navigator.canShare({ files: [new File([""], "test.mp4", { type: "video/mp4" })] });
  } catch {
    return false;
  }
}

/**
 * Downloads a finished creation. On a phone it opens the share sheet with the file instead, where "Save Video" /
 * "Save Image" stores it in Photos (a plain download would land in the Files app); a small link underneath still
 * downloads the file. On a computer it is an ordinary download.
 *
 * Browsers only allow the share sheet right after a tap, and the file has to be fetched first. With `prefetch` the
 * file is fetched as soon as the button shows (the result screen), so one tap saves it. Without it (a long History
 * list) the first tap fetches; if the browser then refuses to open the sheet, the button asks for a second tap.
 *
 * The "Made with ZYRO" badge is added when the watermark switch (WatermarkToggle) is on.
 */
export function SaveButton({
  href,
  label,
  prefetch = false,
  className = "",
  compact = false,
  iconOnly = false,
}: {
  /** The download URL (…?download=1). */
  href: string;
  /** Label of the plain download (computers). */
  label: string;
  prefetch?: boolean;
  className?: string;
  compact?: boolean;
  /** A round download-arrow button (History cards); the label becomes its accessible name. */
  iconOnly?: boolean;
}) {
  const t = useT();
  const [watermark] = useWatermark();
  const url = withWatermark(href, watermark);
  // Read once in the browser (false while rendering on the server).
  const share = useSyncExternalStore(
    noSubscribe,
    canShareFiles,
    () => false,
  );
  // "idle" with prefetch on means the file is still being fetched in the background.
  const [state, setState] = useState<"idle" | "loading" | "ready" | "again" | "failed">("idle");
  // The fetched file, with the URL it came from (flipping the watermark switch needs a different file).
  const fetched = useRef<{ url: string; file: File } | null>(null);
  const ready = () => (fetched.current?.url === url ? fetched.current.file : null);

  async function load() {
    const have = ready();
    if (have) return have;
    const res = await fetch(url);
    if (!res.ok) throw new Error("download_failed");
    const blob = await res.blob();
    const type = blob.type || res.headers.get("content-type") || "video/mp4";
    const f = new File([blob], fileNameFrom(res, "zyro.mp4"), { type });
    fetched.current = { url, file: f };
    return f;
  }

  useEffect(() => {
    if (!share || !prefetch) return;
    let cancelled = false;
    load()
      .then(() => !cancelled && setState("ready"))
      .catch(() => !cancelled && setState("failed"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [share, prefetch, url]);

  async function save() {
    try {
      const f = ready() ?? (setState("loading"), await load());
      await navigator.share({ files: [f] });
      setState("ready");
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name === "AbortError") setState("ready"); // the user closed the sheet
      else if (name === "NotAllowedError" && ready()) setState("again"); // the tap expired while fetching
      else window.location.href = url; // anything else: fall back to a plain download
    }
  }

  if (iconOnly) {
    const name = share ? (state === "again" ? t("save.tapAgain") : t("save.photos")) : label;
    const round = `grid size-9 shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,var(--brand-light),var(--brand))] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.45),0_4px_14px_rgba(47,91,255,0.45)] transition hover:brightness-110 disabled:opacity-60 ${className}`;
    const arrow = (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 4v11M7 10.5l5 5 5-5" />
        <path d="M5 20h14" />
      </svg>
    );
    if (!share) {
      return (
        <a href={url} aria-label={label} title={label} className={round}>
          {arrow}
        </a>
      );
    }
    const busyIcon = state === "loading";
    return (
      <button type="button" onClick={save} disabled={busyIcon} aria-label={name} title={name} className={round}>
        {busyIcon ? <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : arrow}
      </button>
    );
  }

  const size = compact ? "btn-compact" : "";
  const busy = state === "loading" || (prefetch && state === "idle");
  if (!share) {
    return (
      <a href={url} className={`btn-primary ${size} ${className}`}>
        {label}
      </a>
    );
  }
  return (
    <div className={`flex flex-col items-stretch gap-1.5 ${className}`}>
      <button type="button" onClick={save} disabled={busy} className={`btn-primary ${size} disabled:opacity-60`}>
        {busy ? t("save.preparing") : state === "again" ? t("save.tapAgain") : t("save.photos")}
      </button>
      {!compact && (
        <a href={url} className="text-center text-xs text-foreground/60 underline underline-offset-2">
          {t("save.toFiles")}
        </a>
      )}
    </div>
  );
}
