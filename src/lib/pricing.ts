/**
 * The one credit formula. The template editor, the admin pages, the pricing page and the repricing
 * script all call these functions with the same settings, so the numbers cannot drift apart.
 * Pure on purpose (no database, no environment): the settings are passed in.
 */

export type PriceSource = "MANUAL" | "HIGGSFIELD";
export type VideoResolution = "480p" | "720p";
export type ImageQuality = "low" | "medium" | "high";
/** Video and images each have their own target margin, so images can change without touching video. */
export type PriceKind = "video" | "image";

/** Everything the price depends on. Stored in the PricingSetting row and edited in /admin. */
export interface PricingConfig {
  /** MNT one credit is worth, the same in every pack. */
  creditValueMnt: number;
  /** Margin aimed for on video, in percent of revenue. */
  targetMarginPct: number;
  /** The same for images. */
  targetMarginImagesPct: number;
  /** Added on top of the provider cost, as a fraction (0.05 = 5%). */
  retryRate: number;
  /** Share of the revenue the payment gateway keeps, as a fraction (0.01 = 1%). */
  gatewayFeeRate: number;
  /** MNT per USD. */
  usdMnt: number;
  /** Real cost of one second of 480p video on our account (USD). */
  videoUsdPerSecond: number;
  /** How much more 720p costs than 480p. */
  hdMultiplier: number;
  /** Length of the video that a pack's "N videos" count refers to. */
  referenceSeconds: number;
  priceSource: PriceSource;
  /** Quality tier new image templates start with. */
  imageQuality: ImageQuality;
  /** What one 1K image costs at the Low tier (USD), used when no cost is looked up or typed. Published price: about $0.075. */
  imageCostUsd1kLow: number;
  /** Higgsfield's list price per second of 480p video, for the "if the discount ends" risk line. */
  listUsdPerSecond: number;
}

export const DEFAULT_PRICING: PricingConfig = {
  creditValueMnt: 100,
  targetMarginPct: 55,
  targetMarginImagesPct: 55,
  retryRate: 0.05,
  gatewayFeeRate: 0.01,
  usdMnt: 3500,
  videoUsdPerSecond: 0.074,
  hdMultiplier: 2.015,
  referenceSeconds: 15,
  priceSource: "MANUAL",
  imageQuality: "low",
  imageCostUsd1kLow: 0.075,
  listUsdPerSecond: 0.10667,
};

/** A credit pack as sold on the Pricing page. */
export interface PackagePrice {
  id: string;
  name: string;
  credits: number;
  /** Price in MNT (₮). */
  priceMnt: number;
}

export function perCreditMnt(pack: Pick<PackagePrice, "credits" | "priceMnt">) {
  return pack.priceMnt / pack.credits;
}

/**
 * K = (1 + retry) ÷ (1 − margin − gateway): what the provider cost in MNT is multiplied by to get
 * the selling price. The gateway fee is a share of the price, so it comes off the margin.
 */
export function targetMarginFor(cfg: PricingConfig, kind: PriceKind = "video") {
  return kind === "image" ? cfg.targetMarginImagesPct : cfg.targetMarginPct;
}

export function costFactor(cfg: PricingConfig, kind: PriceKind = "video") {
  const keep = 1 - Math.min(Math.max(targetMarginFor(cfg, kind), 0), 95) / 100 - cfg.gatewayFeeRate;
  return (1 + cfg.retryRate) / Math.max(keep, 0.05);
}

/** Credits to charge for a generation that costs `costUsd` at the provider. Rounded up once, on the total. */
export function creditsForCostUsd(costUsd: number, cfg: PricingConfig, kind: PriceKind = "video") {
  const credits = Math.ceil((costUsd * cfg.usdMnt * costFactor(cfg, kind)) / cfg.creditValueMnt - 1e-9);
  return Math.max(1, credits);
}

/** What a video of this length costs at the provider on our account, in USD. */
export function videoCostUsd(seconds: number, resolution: VideoResolution, cfg: PricingConfig) {
  return seconds * cfg.videoUsdPerSecond * (resolution === "720p" ? cfg.hdMultiplier : 1);
}

/** Credits for a video of this length, from the per-second rate. */
export function videoCredits(seconds: number, resolution: VideoResolution, cfg: PricingConfig) {
  return creditsForCostUsd(videoCostUsd(seconds, resolution, cfg), cfg);
}

/** Credits for one 1K image at the default (Low) tier: what pack counts and the pricing page use. */
export function imageCredits1k(cfg: PricingConfig) {
  return creditsForCostUsd(cfg.imageCostUsd1kLow, cfg, "image");
}

/** What the same video would cost at Higgsfield's list price (no account discount), in USD. */
export function videoListCostUsd(seconds: number, resolution: VideoResolution, cfg: PricingConfig) {
  return seconds * cfg.listUsdPerSecond * (resolution === "720p" ? cfg.hdMultiplier : 1);
}

/**
 * What one generation earns and costs at `credits`. Total cost is the provider's price plus the retry
 * buffer on it plus the gateway's cut of the revenue.
 */
export function marginFor({ costUsd, credits, cfg }: { costUsd: number; credits: number; cfg: PricingConfig }) {
  const revenueMnt = credits * cfg.creditValueMnt;
  const providerMnt = costUsd * cfg.usdMnt;
  const retryMnt = providerMnt * cfg.retryRate;
  const feeMnt = revenueMnt * cfg.gatewayFeeRate;
  const costMnt = providerMnt + retryMnt + feeMnt;
  return {
    revenueMnt,
    providerMnt,
    retryMnt,
    feeMnt,
    /** Everything it costs to serve one generation: provider + retry buffer + gateway fee. */
    costMnt,
    marginMnt: revenueMnt - costMnt,
    /** Share of the revenue left after all costs; 0 when there is no revenue. */
    marginPct: revenueMnt > 0 ? ((revenueMnt - costMnt) / revenueMnt) * 100 : 0,
  };
}

/** MNT per USD from the USD_MNT_RATE environment variable (the default when the admin has not set one). */
export function usdMntRate() {
  const rate = Number(process.env.USD_MNT_RATE);
  return Number.isFinite(rate) && rate > 0 ? rate : 3500;
}
