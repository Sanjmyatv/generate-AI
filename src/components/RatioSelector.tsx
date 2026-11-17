"use client";

import { useT } from "@/components/I18nProvider";
import { parseRatio } from "@/lib/ratio";

/** A tiny rectangle in the ratio's shape. */
function ShapeIcon({ ratio }: { ratio: string }) {
  const value = parseRatio(ratio) ?? 1;
  const height = 14;
  const width = Math.max(8, Math.min(24, Math.round(height * value)));
  return <span aria-hidden="true" className="inline-block rounded-[2px] border-[1.5px] border-current" style={{ width, height }} />;
}

/**
 * The image ratio as pill chips above the price and the generate button: "Автомат" (with the detected ratio once a
 * photo is chosen) and the ratios the template allows. A fixed template shows one locked chip. The price never
 * depends on the ratio.
 */
export function RatioSelector({
  mode,
  ratios,
  userRatio,
  fixed,
  value,
  onChange,
  detected,
}: {
  mode: "auto" | "fixed";
  ratios: string[];
  userRatio: boolean;
  fixed: string | null;
  value: string;
  onChange: (ratio: string) => void;
  detected: string | null;
}) {
  const t = useT();

  if (mode === "fixed" || !userRatio) {
    const label = mode === "fixed" ? (fixed ?? t("ratio.auto")) : detected ? t("ratio.autoDetected", { ratio: detected }) : t("ratio.auto");
    return (
      <div role="group" aria-label={t("ratio.label")} className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">{t("ratio.label")}</span>
        <span className="chip-glass inline-flex min-h-9 items-center gap-2 px-3 text-sm opacity-90">
          {mode === "fixed" && fixed && <ShapeIcon ratio={fixed} />}
          {label} · {t("ratio.locked")}
        </span>
      </div>
    );
  }

  const chips = [{ id: "auto", label: detected ? t("ratio.autoDetected", { ratio: detected }) : t("ratio.auto") }, ...ratios.map((r) => ({ id: r, label: r }))];
  return (
    <div role="group" aria-label={t("ratio.label")} className="space-y-2">
      <span className="text-xs text-muted">{t("ratio.label")}</span>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const on = value === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(chip.id)}
              className={`inline-flex min-h-11 items-center gap-2 px-4 text-sm ${on ? "chip-brand" : "chip-glass hover:border-brand"}`}
            >
              <ShapeIcon ratio={chip.id === "auto" ? (detected ?? "1:1") : chip.id} />
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
