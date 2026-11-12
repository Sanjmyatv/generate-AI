"use client";

import { useT } from "@/components/I18nProvider";

/**
 * How far along a job looks, 0 to 100. The providers report no progress, so this is a smooth
 * estimate from the time spent: it climbs quickly, slows down, and never reaches 100 on its
 * own (the result appearing is what completes it).
 */
function estimatePercent(elapsedSeconds: number, isVideo: boolean) {
  const typicalSeconds = isVideo ? 100 : 30;
  return Math.max(3, Math.min(96, 96 * (1 - Math.exp(-elapsedSeconds / typicalSeconds))));
}

/** The progress bar shown while a video or image is being made: a percentage, a status line and a glowing frame. */
export function GenerationProgress({ elapsed, isVideo }: { elapsed: number; isVideo: boolean }) {
  const t = useT();
  const percent = Math.round(estimatePercent(elapsed, isVideo));
  const stage = percent < 30 ? "gen.stage1" : percent < 75 ? "gen.stage2" : "gen.stage3";

  return (
    <div className="glow-box mt-6" role="status" aria-live="polite">
      <div className="glow-inner text-center">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <p className="font-semibold">{t(stage)}</p>
          <p className="tabular-nums text-foreground/80">{percent}%</p>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10"
        >
          <div className="progress-fill h-full rounded-full" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-3 text-xs text-foreground/60">
          {t("gen.mayTake")} · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
        </p>
      </div>
    </div>
  );
}
