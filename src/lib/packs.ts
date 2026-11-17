import { imageCredits1k, videoCredits, type PricingConfig } from "./pricing";

/** What a pack's credits cover, counted from the price list: always rounded down, so a card never overpromises. */
export interface PackCounts {
  /** 1K images. */
  images: number;
  /** Videos of the reference length at 480p / 720p HD. */
  video480: number;
  video720: number;
}

/** Credits of the reference video (15 s by default) at each resolution, from the pricing settings. */
export function referenceCredits(cfg: PricingConfig) {
  return {
    video480: videoCredits(cfg.referenceSeconds, "480p", cfg),
    video720: videoCredits(cfg.referenceSeconds, "720p", cfg),
  };
}

export function packCounts(credits: number, cfg: PricingConfig): PackCounts {
  const ref = referenceCredits(cfg);
  return {
    images: Math.floor(credits / imageCredits1k(cfg)),
    video480: Math.floor(credits / ref.video480),
    video720: Math.floor(credits / ref.video720),
  };
}

/** How many reference videos (480p) each pack must cover: Starter none, Lite at least 1, Pro 2, Business 4. */
export const PACK_VIDEO_RULES: Record<string, { min?: number; max?: number }> = {
  trial: { max: 0 },
  light: { min: 1 },
  pro: { min: 2 },
  business: { min: 4 },
};

/** Rule violations for a pack, in plain English for the admin. Packs without a rule have none. */
export function packWarnings(id: string, counts: PackCounts, referenceSeconds: number): string[] {
  const rule = PACK_VIDEO_RULES[id];
  if (!rule) return [];
  const out: string[] = [];
  if (rule.max !== undefined && counts.video480 > rule.max) {
    out.push(`Must cover ${rule.max} videos of ${referenceSeconds} s at 480p, but covers ${counts.video480}.`);
  }
  if (rule.min !== undefined && counts.video480 < rule.min) {
    out.push(`Must cover at least ${rule.min} video${rule.min === 1 ? "" : "s"} of ${referenceSeconds} s at 480p, but covers ${counts.video480}.`);
  }
  return out;
}
