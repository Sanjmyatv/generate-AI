"use client";

import { useT } from "@/components/I18nProvider";
import type { PhotoRequirement as Mode } from "@/types";

function PersonIcon({ mode }: { mode: Mode }) {
  return mode === "face" ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
      <circle cx="12" cy="4" r="2" />
      <path d="M9 9.5h6l-1 5.5h-4z" />
      <path d="M10 15l-1 7M14 15l1 7M9 9.5 6.5 13M15 9.5l2.5 3.5" />
    </svg>
  );
}

function BulbIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2.2h5c.1-1 .5-1.7 1.1-2.2A6 6 0 0 0 12 3z" />
    </svg>
  );
}

/** The "which photo to use" line under the photo slots: a person icon in a soft brand chip, then the hint. */
export function PhotoHint({ mode, text }: { mode: Mode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-brand-light/20 bg-brand/10 px-3.5 py-2.5">
      <span className="grid size-9 flex-none place-items-center rounded-full bg-[linear-gradient(145deg,var(--brand-light),var(--brand))] text-white shadow-[0_0_16px_rgba(47,91,255,0.45)]">
        <PersonIcon mode={mode} />
      </span>
      <p className="text-[13px] leading-snug text-foreground/85">{text}</p>
    </div>
  );
}

/**
 * The soft yellow reminder that the photo decides the result. "before": above the Generate button, with what makes a
 * good photo. "during": under the progress bar, a short line on what to do if the result looks off.
 */
export function PhotoQualityNotice({ mode, when }: { mode: Mode; when: "before" | "during" }) {
  const t = useT();
  const tips =
    mode === "face"
      ? [t("tips.faceFront"), t("tips.light"), t("tips.faceClear")]
      : [t("tips.fullBody"), t("tips.light"), t("tips.alone")];
  return (
    <div role="note" className="flex gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/[0.08] p-3.5 text-left">
      <span className="grid size-8 flex-none place-items-center rounded-full bg-amber-300/15 text-amber-200">
        <BulbIcon />
      </span>
      <div className="min-w-0 space-y-1.5">
        <p className="text-[13px] font-semibold text-amber-100">{t(when === "before" ? "tips.title" : "tips.duringTitle")}</p>
        <p className="text-[12.5px] leading-relaxed text-amber-50/75">{t(when === "before" ? "tips.body" : "tips.duringBody")}</p>
        {when === "before" && (
          <ul className="flex flex-wrap gap-1.5 pt-0.5">
            {tips.map((tip) => (
              <li key={tip} className="flex items-center gap-1 rounded-full bg-amber-300/10 px-2.5 py-1 text-[11.5px] font-medium text-amber-100/90">
                <span aria-hidden="true">✓</span>
                {tip}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
