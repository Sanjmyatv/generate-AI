/**
 * Credit pricing (Credit Pricing Requirement). One place for the numbers the seed, the
 * admin "standard price" button and the pricing UI share. Prices are stored per template in
 * the database, so editing a template in /admin changes what users pay for it; this file
 * only holds the standard price list.
 */

/** Base conversion: 1 credit is worth ₮1 (10,000 credits = ₮10,000). */
export const CREDIT_VALUE_MNT = 1;

export type Resolution = "480p" | "720p";

/** 480p is the default; 720p HD is an opt-in upgrade. */
export const DEFAULT_RESOLUTION: Resolution = "480p";
export const RESOLUTIONS: readonly Resolution[] = ["480p", "720p"];

export const RESOLUTION_LABELS: Record<Resolution, { label: string; tagline: string }> = {
  "480p": { label: "480p", tagline: "Fast & Eco" },
  "720p": { label: "720p HD", tagline: "HD / Pro" },
};

/** Sunburst image render: one price, no resolution choice. */
export const IMAGE_CREDITS = 100;

/** Video lengths are fixed tiers of 10 to 20 seconds. */
export const VIDEO_TIERS = [10, 20] as const;
export type VideoTier = (typeof VIDEO_TIERS)[number];

export const VIDEO_CREDITS: Record<VideoTier, Record<Resolution, number>> = {
  10: { "480p": 3_500, "720p": 5_000 },
  20: { "480p": 6_500, "720p": 9_000 },
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

/** Credits a new Google/Apple account starts with. */
export const SIGNUP_BONUS_CREDITS = 1_000;

export interface PackageDefinition {
  id: string;
  name: string;
  priceMnt: number;
  /** Total credits issued, bonus included. */
  credits: number;
  bonusCredits: number;
  highlighted: boolean;
}

/** QPay tiers. `credits` already includes the bonus. */
export const PACKAGES: PackageDefinition[] = [
  { id: "starter", name: "Starter Pack", priceMnt: 10_000, credits: 10_000, bonusCredits: 0, highlighted: false },
  { id: "creator", name: "Creator Pack", priceMnt: 30_000, credits: 35_000, bonusCredits: 5_000, highlighted: true },
  { id: "pro", name: "Pro Agency Pack", priceMnt: 90_000, credits: 115_000, bonusCredits: 25_000, highlighted: false },
];

/**
 * What a pack buys, as the bullet list on its pricing card. The counts are worked out from the
 * credits and the price list above, so the card can never promise more than the credits cover
 * (10,000 credits buy two 10 s videos at 480p, not three).
 */
export function packageHighlights(pack: Pick<PackageDefinition, "id" | "credits">): string[] {
  const n = (credits: number, each: number) => Math.floor(credits / each);
  const images = n(pack.credits, IMAGE_CREDITS);
  const v10 = n(pack.credits, VIDEO_CREDITS[10]["480p"]);
  const v20 = n(pack.credits, VIDEO_CREDITS[20]["480p"]);
  const hd10 = n(pack.credits, VIDEO_CREDITS[10]["720p"]);
  const hd20 = n(pack.credits, VIDEO_CREDITS[20]["720p"]);
  const imagesLine = `Up to ${formatCredits(images)} AI images`;
  const expiry = "Credits never expire";

  switch (pack.id) {
    case "starter": {
      // One 20 s video, then the images the rest of the credits cover.
      const left = n(pack.credits - VIDEO_CREDITS[20]["480p"], IMAGE_CREDITS);
      return [
        imagesLine,
        `${v10}x 10-second videos (480p) OR 1x 20-second video + ${left} images`,
        expiry,
        "Automatic refund on failed generations",
      ];
    }
    case "creator":
      return [
        imagesLine,
        `${v10}x 10-second videos (480p) OR ${v20}x 20-second videos (480p)`,
        `${hd10}x 10-second HD videos (720p)`,
        expiry,
        "Priority rendering queue",
      ];
    case "pro":
      return [
        imagesLine,
        `${v10}x 10-second videos (480p) OR ${v20}x 20-second videos (480p)`,
        `${hd20}x 20-second HD videos (720p)`,
        expiry,
        "Maximum queue priority",
      ];
    default:
      return [imagesLine, `${v10}x 10-second videos (480p)`, expiry];
  }
}

export function formatCredits(n: number) {
  return n.toLocaleString("en-US");
}
