import { prisma } from "@/lib/db";
import { DEFAULT_PRICING_RATES, type PricingRates } from "@/lib/pricing";

/** The rates the automatic selling price uses: what the admin saved, else the defaults. */
export async function getPricingRates(): Promise<PricingRates> {
  const row = await prisma.pricingSetting.findUnique({ where: { id: "default" } });
  if (!row) return DEFAULT_PRICING_RATES;
  return { retryRate: Number(row.retryBufferRate), gatewayFeeRate: Number(row.gatewayFeeRate) };
}
