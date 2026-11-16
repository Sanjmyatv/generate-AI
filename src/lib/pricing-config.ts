import type { PricingSetting } from "@/generated/prisma/client";
import { DEFAULT_PRICING, usdMntRate, type PricingConfig } from "@/lib/pricing";

/** The settings row as the pricing functions want it. No database access, so scripts can reuse it. */
export function toPricingConfig(row: PricingSetting | null): PricingConfig {
  if (!row) return { ...DEFAULT_PRICING, usdMnt: usdMntRate() };
  return {
    creditValueMnt: row.creditValueMnt,
    targetMarginPct: Number(row.targetMarginPct),
    retryRate: Number(row.retryBufferRate),
    gatewayFeeRate: Number(row.gatewayFeeRate),
    usdMnt: row.usdMntRate === null ? usdMntRate() : Number(row.usdMntRate),
    videoUsdPerSecond: Number(row.videoUsdPerSecond),
    hdMultiplier: Number(row.hdMultiplier),
    referenceSeconds: row.referenceSeconds,
    priceSource: row.priceSource === "HIGGSFIELD" ? "HIGGSFIELD" : "MANUAL",
    listUsdPerSecond: Number(row.listUsdPerSecond),
  };
}
