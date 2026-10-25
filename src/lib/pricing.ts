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

/** What one generation earns and costs when a user pays `perCredit` ₮ per credit. */
export function marginFor({
  costUsd,
  creditCost,
  perCredit,
  usdMnt,
}: {
  costUsd: number;
  creditCost: number;
  perCredit: number;
  usdMnt: number;
}) {
  const revenueMnt = creditCost * perCredit;
  const costMnt = costUsd * usdMnt;
  return {
    revenueMnt,
    costMnt,
    marginMnt: revenueMnt - costMnt,
    /** Share of the revenue left after the provider's cost; 0 when there is no revenue. */
    marginPct: revenueMnt > 0 ? ((revenueMnt - costMnt) / revenueMnt) * 100 : 0,
  };
}

/** Fewest whole credits that keep at least `targetPct` margin at this credit price. */
export function creditsForMargin({
  costUsd,
  perCredit,
  usdMnt,
  targetPct,
}: {
  costUsd: number;
  perCredit: number;
  usdMnt: number;
  targetPct: number;
}) {
  const keep = 1 - Math.min(Math.max(targetPct, 0), 95) / 100;
  return Math.max(1, Math.ceil((costUsd * usdMnt) / (perCredit * keep)));
}

/** MNT per USD used to turn provider costs into ₮. Override with USD_MNT_RATE. */
export function usdMntRate() {
  const rate = Number(process.env.USD_MNT_RATE);
  return Number.isFinite(rate) && rate > 0 ? rate : 3500;
}
