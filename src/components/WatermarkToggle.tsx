"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/components/I18nProvider";

const KEY = "zyro.watermark";
const listeners = new Set<() => void>();

function read() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/**
 * Whether downloads carry the small "Made with ZYRO" badge (bottom-right). On unless the visitor turned it off; the
 * choice is remembered in this browser and shared by every download button on the page.
 */
export function useWatermark(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, read, () => true);
  const set = (value: boolean) => {
    try {
      localStorage.setItem(KEY, value ? "on" : "off");
    } catch {
      /* private mode: still applies until the page is left */
    }
    listeners.forEach((l) => l());
  };
  return [on, set];
}

/** Adds `watermark=1` to a download URL when the badge is on. */
export function withWatermark(href: string, on: boolean) {
  return on ? `${href}${href.includes("?") ? "&" : "?"}watermark=1` : href;
}

/** The switch shown beside the download buttons. */
export function WatermarkToggle({ className = "" }: { className?: string }) {
  const t = useT();
  const [on, setOn] = useWatermark();
  return (
    <label className={`inline-flex cursor-pointer select-none items-center gap-2.5 text-[13px] text-foreground/75 ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn(!on)}
        className={`relative h-6 w-10 flex-none rounded-full border transition-colors ${
          on ? "border-brand-light/60 bg-[linear-gradient(145deg,var(--brand-light),var(--brand))]" : "border-white/15 bg-white/10"
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-1/2 size-[18px] -translate-y-1/2 rounded-full bg-white shadow transition-[left] ${on ? "left-[19px]" : "left-[2px]"}`}
        />
      </button>
      {t("save.watermark")}
    </label>
  );
}
