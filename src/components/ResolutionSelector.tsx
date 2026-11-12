"use client";

import { useT } from "@/components/I18nProvider";
import { formatCredits } from "@/config/pricing";

export interface QualityOption {
  id: string;
  /** "480p", "720p HD", "1K"… */
  label: string;
  /** "Fast & Eco", "HD / Pro"… */
  tagline: string;
  credits: number;
}

/**
 * The quality choice before generating: 480p (the default) or 720p HD for video, 1K, 2K or 4K for
 * images when the template offers them. Each option shows what that choice costs, so the price is
 * clear before generating.
 */
export function ResolutionSelector({
  value,
  onChange,
  options,
  groupLabel,
}: {
  value: string;
  onChange: (id: string) => void;
  options: QualityOption[];
  groupLabel: string;
}) {
  const t = useT();
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{t("res.quality")}</p>
      <div
        role="radiogroup"
        aria-label={groupLabel}
        className={`grid gap-3 ${options.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}
      >
        {options.map((option) => {
          const on = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(option.id)}
              className={`flex flex-col items-start rounded-2xl border px-4 py-3 text-left transition ${
                on
                  ? "border-[rgba(139,92,246,0.6)] bg-[rgba(139,92,246,0.13)]"
                  : "border-line bg-surface hover:bg-[rgba(255,255,255,0.07)]"
              }`}
            >
              <span className={`text-[15px] font-medium ${on ? "text-purple-soft" : "text-foreground"}`}>
                {option.label}
              </span>
              <span className="text-[11px] text-muted">{option.tagline}</span>
              <span className="mt-2 text-[12px] text-foreground">
                {t("res.credits", { amount: formatCredits(option.credits) })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
