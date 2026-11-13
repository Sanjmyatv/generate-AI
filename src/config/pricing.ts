import type { T } from "@/lib/i18n/translate";

/**
 * Credit pricing (Credit Pricing Requirement). One place for the numbers the seed, the
 * admin "standard price" button and the pricing UI share. Prices are stored per template in
 * the database, so editing a template in /admin changes what users pay for it; this file
 * only holds the standard price list.
 */

/** Base conversion: 1 credit is worth ₮100 (a 5,000₮ pack buys 50 credits). */
export const CREDIT_VALUE_MNT = 100;

export type Resolution = "480p" | "720p";

/** 480p is the default; 720p HD is an opt-in upgrade. */
export const DEFAULT_RESOLUTION: Resolution = "480p";
export const RESOLUTIONS: readonly Resolution[] = ["480p", "720p"];

export const RESOLUTION_LABELS: Record<Resolution, { label: string; tagline: string }> = {
  "480p": { label: "480p", tagline: "Fast & Eco" },
  "720p": { label: "720p HD", tagline: "HD / Pro" },
};

/** Image render qualities and what each costs by default. */
export const IMAGE_TIER_CREDITS = { "1k": 3, "2k": 6, "4k": 10 } as const;

/** Standard image price: the 1K render. */
export const IMAGE_CREDITS: number = IMAGE_TIER_CREDITS["1k"];

/** Video lengths are fixed tiers of 10 to 20 seconds. */
export const VIDEO_TIERS = [10, 20] as const;
export type VideoTier = (typeof VIDEO_TIERS)[number];

/**
 * The 20 s tier is what the Genjutsu templates (15 s source video, about $2.4-2.5 at 480p and $5.11 at 720p)
 * cost to run, priced for a ~55% margin after the retry buffer and gateway fee. The 10 s tier has no provider
 * cost on record: check it in /admin before relying on it.
 */
export const VIDEO_CREDITS: Record<VideoTier, Record<Resolution, number>> = {
  10: { "480p": 35, "720p": 50 },
  20: { "480p": 215, "720p": 435 },
};

/** The tier a video of this length is priced in: up to 10 s is the 10 s tier, anything longer the 20 s tier. */
export function videoTier(durationSeconds: number | null | undefined): VideoTier {
  return durationSeconds && durationSeconds > VIDEO_TIERS[0] ? 20 : 10;
}

/** Standard credits for a template, for the admin form's "apply standard price" button. */
export function standardPrice(type: "VIDEO" | "IMAGE", durationSeconds: number | null | undefined) {
  if (type === "IMAGE") return { credits: IMAGE_CREDITS, creditsHd: null };
  const tier = VIDEO_CREDITS[videoTier(durationSeconds)];
  return { credits: tier["480p"], creditsHd: tier["720p"] };
}

/** Credits a new Google account starts with (₮1,000 worth). */
export const SIGNUP_BONUS_CREDITS = 10;

export interface PackageDefinition {
  id: string;
  name: string;
  priceMnt: number;
  /** Total credits issued, bonus included. */
  credits: number;
  bonusCredits: number;
  highlighted: boolean;
}

/** QPay tiers. `credits` already includes the bonus; every pack is priced at ₮100 per credit. */
export const PACKAGES: PackageDefinition[] = [
  { id: "trial", name: "Trial", priceMnt: 5_000, credits: 50, bonusCredits: 0, highlighted: false },
  { id: "light", name: "Light Creator", priceMnt: 9_000, credits: 90, bonusCredits: 0, highlighted: false },
  { id: "pro", name: "Pro Creator", priceMnt: 23_000, credits: 230, bonusCredits: 0, highlighted: true },
  { id: "business", name: "Business", priceMnt: 45_000, credits: 450, bonusCredits: 0, highlighted: false },
];

/**
 * What a pack buys, as the bullet list on its pricing card. The counts are worked out from the
 * credits and the price list above, so the card can never promise more than the credits cover
 * (50 credits buy one 10 s video at 480p, not two).
 */
export function packageHighlights(pack: Pick<PackageDefinition, "id" | "credits">, t: T): string[] {
  const n = (credits: number, each: number) => Math.floor(credits / each);
  const images = n(pack.credits, IMAGE_CREDITS);
  const v10 = n(pack.credits, VIDEO_CREDITS[10]["480p"]);
  const v20 = n(pack.credits, VIDEO_CREDITS[20]["480p"]);
  const hd10 = n(pack.credits, VIDEO_CREDITS[10]["720p"]);
  const hd20 = n(pack.credits, VIDEO_CREDITS[20]["720p"]);
  const imagesLine = t("hl.images", { n: formatCredits(images) });
  const expiry = t("hl.expiry");

  switch (pack.id) {
    case "trial":
      return [imagesLine, t("hl.videosOnly", { v10 }), expiry, t("hl.refund")];
    case "light":
      return [imagesLine, t("hl.videosOnly", { v10 }), expiry, t("hl.refund")];
    case "pro":
      return [imagesLine, t("hl.videos", { v10, v20 }), t("hl.hd10", { n: hd10 }), expiry, t("hl.priority")];
    case "business":
      return [imagesLine, t("hl.videos", { v10, v20 }), t("hl.hd20", { n: hd20 }), expiry, t("hl.maxPriority")];
    default:
      return [imagesLine, t("hl.videosOnly", { v10 }), expiry];
  }
}

/**
 * Credits as users see them: always a whole number, rounded up. The wallet and the ledger keep the
 * exact 2-decimal value; this is only for display.
 */
export function formatCredits(n: number) {
  return Math.ceil(n).toLocaleString("en-US");
}
