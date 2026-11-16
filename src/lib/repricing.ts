import { GENJUTSU_LIGHT_MAX_SECONDS } from "@/config/pricing";
import { videoCredits, type PricingConfig } from "@/lib/pricing";

/** The fields of a template the repricing needs. */
export interface RepriceTemplate {
  id: string;
  name: string;
  type: "VIDEO" | "IMAGE";
  durationSeconds: number | null;
  generationConfig: unknown;
  creditCost: number;
  creditCostHd: number | null;
  autoCredits: boolean;
}

export interface PriceChange {
  id: string;
  name: string;
  seconds: number;
  oldCredits: number;
  oldCreditsHd: number | null;
  newCredits: number;
  newCreditsHd: number | null;
}

/** Seconds the price is worked out for: the template's length, capped at what Genjutsu Light uses. */
export function pricedSeconds(t: Pick<RepriceTemplate, "durationSeconds" | "generationConfig">): number | null {
  if (!t.durationSeconds) return null;
  const light = (t.generationConfig as { light?: boolean } | null)?.light === true;
  return light ? Math.min(t.durationSeconds, GENJUTSU_LIGHT_MAX_SECONDS) : t.durationSeconds;
}

/** What the formula would charge this template (HD only when the template offers it). Null for images or no length. */
export function formulaPrice(t: RepriceTemplate, cfg: PricingConfig) {
  const seconds = t.type === "VIDEO" ? pricedSeconds(t) : null;
  if (seconds === null) return null;
  return {
    seconds,
    credits: videoCredits(seconds, "480p", cfg),
    creditsHd: t.creditCostHd === null ? null : videoCredits(seconds, "720p", cfg),
  };
}

/**
 * Splits video templates into the ones priced automatically (repriced by a settings change, once the
 * admin confirms) and the ones priced by hand (never touched; listed for review with what the formula would say).
 */
export function planRepricing(templates: RepriceTemplate[], cfg: PricingConfig) {
  const auto: PriceChange[] = [];
  const manual: (PriceChange & { differs: boolean })[] = [];
  for (const t of templates) {
    const price = formulaPrice(t, cfg);
    if (!price) continue;
    const row = {
      id: t.id,
      name: t.name,
      seconds: price.seconds,
      oldCredits: t.creditCost,
      oldCreditsHd: t.creditCostHd,
      newCredits: price.credits,
      newCreditsHd: price.creditsHd,
    };
    const differs = row.oldCredits !== row.newCredits || row.oldCreditsHd !== row.newCreditsHd;
    if (t.autoCredits) {
      if (differs) auto.push(row);
    } else manual.push({ ...row, differs });
  }
  return { auto, manual };
}
