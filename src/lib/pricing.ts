/** A credit pack as sold on the Pricing page. */
export interface PackagePrice {
  id: string;
  name: string;
  credits: number;
  /** Price in MNT (₮). */
  priceMnt: number;
}

/**
 * The two costs on top of the provider's price that the selling price has to cover. Both are
 * shares written as fractions (0.05 = 5%) and are edited in the admin pricing settings.
 */
export interface PricingRates {
  /** Added to the provider cost for failed or repeated requests we still pay for. */
  retryRate: number;
  /** Share of the selling price the payment gateway keeps. */
  gatewayFeeRate: number;
}

export const DEFAULT_PRICING_RATES: PricingRates = { retryRate: 0.05, gatewayFeeRate: 0.015 };

export function perCreditMnt(pack: Pick<PackagePrice, "credits" | "priceMnt">) {
  return pack.priceMnt / pack.credits;
}

/**
 * What one generation earns and costs when a user pays `perCredit` ₮ per credit. The cost is the
 * provider's price plus the retry buffer on it plus the gateway's cut of what the user paid.
 */
export function marginFor({
  costUsd,
  creditCost,
  perCredit,
  usdMnt,
  retryRate = 0,
  gatewayFeeRate = 0,
}: {
  costUsd: number;
  creditCost: number;
  perCredit: number;
  usdMnt: number;
} & Partial<PricingRates>) {
  const revenueMnt = creditCost * perCredit;
  const providerMnt = costUsd * usdMnt;
  const retryMnt = providerMnt * retryRate;
  const feeMnt = revenueMnt * gatewayFeeRate;
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

/**
 * Fewest credits (to 2 decimals) that keep at least `targetPct` margin at this credit price:
 * price = provider cost × (1 + retry buffer) ÷ (1 − margin − gateway fee), then ÷ ₮ per credit.
 * The gateway fee is a share of the price, so it is taken off the margin rather than added to the cost.
 */
export function creditsForMargin({
  costUsd,
  perCredit,
  usdMnt,
  targetPct,
  retryRate = 0,
  gatewayFeeRate = 0,
}: {
  costUsd: number;
  perCredit: number;
  usdMnt: number;
  targetPct: number;
} & Partial<PricingRates>) {
  const keep = Math.max(1 - Math.min(Math.max(targetPct, 0), 95) / 100 - gatewayFeeRate, 0.05);
  const priceMnt = (costUsd * usdMnt * (1 + retryRate)) / keep;
  return Math.max(0.01, Math.ceil((priceMnt / perCredit) * 100 - 1e-9) / 100);
}

/** MNT per USD used to turn provider costs into ₮. Override with USD_MNT_RATE. */
export function usdMntRate() {
  const rate = Number(process.env.USD_MNT_RATE);
  return Number.isFinite(rate) && rate > 0 ? rate : 3500;
}
