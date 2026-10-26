"use client";

import { RESOLUTION_LABELS, formatCredits, type Resolution } from "@/config/pricing";

/**
 * 480p ("Fast & Eco") is selected by default; 720p HD is an opt-in upgrade. Each pill shows
 * what that choice costs, so the price is clear before generating.
 */
export function ResolutionSelector({
  value,
  onChange,
  options,
}: {
  value: Resolution;
  onChange: (resolution: Resolution) => void;
  options: { resolution: Resolution; credits: number }[];
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">Quality</p>
      <div role="radiogroup" aria-label="Video resolution" className="grid grid-cols-2 gap-3">
        {options.map((option) => {
          const on = option.resolution === value;
          const label = RESOLUTION_LABELS[option.resolution];
          return (
            <button
              key={option.resolution}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(option.resolution)}
              className={`flex flex-col items-start rounded-2xl border px-4 py-3 text-left transition ${
                on
                  ? "border-[rgba(139,92,246,0.6)] bg-[rgba(139,92,246,0.13)]"
                  : "border-line bg-surface hover:bg-[rgba(255,255,255,0.07)]"
              }`}
            >
              <span className={`text-[15px] font-medium ${on ? "text-purple-soft" : "text-foreground"}`}>
                {label.label}
              </span>
              <span className="text-[11px] text-muted">{label.tagline}</span>
              <span className="mt-2 text-[12px] text-foreground">{formatCredits(option.credits)} credits</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
