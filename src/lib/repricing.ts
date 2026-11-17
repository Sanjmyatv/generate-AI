import { GENJUTSU_LIGHT_MAX_SECONDS } from "@/config/pricing";
import { creditsForCostUsd, videoCredits, type PricingConfig } from "@/lib/pricing";

/** The fields of a template the repricing needs. */
export interface RepriceTemplate {
  id: string;
  name: string;
  type: "VIDEO" | "IMAGE";
  durationSeconds: number | null;
  generationConfig: unknown;
  creditCost: number;
  creditCostHd: number | null;
  creditCost2k: number | null;
  creditCost4k: number | null;
  autoCredits: boolean;
}

/** One price a template has: 480p / 720p HD for a video, 1K / 2K / 4K for an image. */
export interface PriceLine {
  key: "creditCost" | "creditCostHd" | "creditCost2k" | "creditCost4k";
  label: string;
  oldCredits: number | null;
  newCredits: number | null;
}

export interface PriceChange {
  id: string;
  name: string;
  /** Video length in seconds; null for images. */
  seconds: number | null;
  lines: PriceLine[];
}

/** Seconds the price is worked out for: the template's length, capped at what Genjutsu Light uses. */
export function pricedSeconds(t: Pick<RepriceTemplate, "durationSeconds" | "generationConfig">): number | null {
  if (!t.durationSeconds) return null;
  const light = (t.generationConfig as { light?: boolean } | null)?.light === true;
  return light ? Math.min(t.durationSeconds, GENJUTSU_LIGHT_MAX_SECONDS) : t.durationSeconds;
}

const costOf = (config: unknown, key: string) => {
  const v = (config as Record<string, unknown> | null)?.[key];
  return typeof v === "number" && v > 0 ? v : null;
};

/**
 * What the formula would charge this template, line by line. Video: from its length. Image: from the provider
 * cost on record for each quality (the 1K Low default when none is saved); 2K and 4K only where the template
 * offers them and a cost is on record, because an unverified cost never gets a price.
 */
export function formulaLines(t: RepriceTemplate, cfg: PricingConfig): { seconds: number | null; lines: PriceLine[] } | null {
  if (t.type === "VIDEO") {
    const seconds = pricedSeconds(t);
    if (seconds === null) return null;
    return {
      seconds,
      lines: [
        { key: "creditCost", label: "480p", oldCredits: t.creditCost, newCredits: videoCredits(seconds, "480p", cfg) },
        {
          key: "creditCostHd",
          label: "720p",
          oldCredits: t.creditCostHd,
          newCredits: t.creditCostHd === null ? null : videoCredits(seconds, "720p", cfg),
        },
      ],
    };
  }
  const quality = (t.generationConfig as { quality?: string } | null)?.quality ?? cfg.imageQuality;
  const cost1k = costOf(t.generationConfig, "costUsd") ?? (quality === "low" ? cfg.imageCostUsd1kLow : null);
  if (cost1k === null) return null;
  const tier = (offered: number | null, key: string) => {
    const c = costOf(t.generationConfig, key);
    return offered === null || c === null ? null : creditsForCostUsd(c, cfg, "image");
  };
  return {
    seconds: null,
    lines: [
      { key: "creditCost", label: "1K", oldCredits: t.creditCost, newCredits: creditsForCostUsd(cost1k, cfg, "image") },
      { key: "creditCost2k", label: "2K", oldCredits: t.creditCost2k, newCredits: tier(t.creditCost2k, "costUsd2k") },
      { key: "creditCost4k", label: "4K", oldCredits: t.creditCost4k, newCredits: tier(t.creditCost4k, "costUsd4k") },
    ],
  };
}

/**
 * Splits templates into the ones priced automatically (repriced by a settings change, once the admin confirms)
 * and the ones priced by hand (never touched; listed for review with what the formula would say).
 */
export function planRepricing(templates: RepriceTemplate[], cfg: PricingConfig) {
  const auto: PriceChange[] = [];
  const manual: (PriceChange & { differs: boolean })[] = [];
  for (const t of templates) {
    const priced = formulaLines(t, cfg);
    if (!priced) continue;
    const row = { id: t.id, name: t.name, seconds: priced.seconds, lines: priced.lines };
    const differs = priced.lines.some((l) => l.oldCredits !== l.newCredits);
    if (t.autoCredits) {
      if (differs) auto.push(row);
    } else manual.push({ ...row, differs });
  }
  return { auto, manual };
}

/** The columns a change writes: every line's new price (an empty one clears the tier). */
export function changeData(change: PriceChange) {
  const by = Object.fromEntries(change.lines.map((l) => [l.key, l.newCredits]));
  return {
    creditCost: by.creditCost as number,
    creditCostHd: by.creditCostHd ?? null,
    creditCost2k: by.creditCost2k ?? null,
    creditCost4k: by.creditCost4k ?? null,
  };
}
