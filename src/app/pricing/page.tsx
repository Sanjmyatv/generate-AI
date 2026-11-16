import { PricingPlans } from "@/components/PricingPlans";
import { IMAGE_CREDITS, SIGNUP_BONUS_CREDITS, formatCredits } from "@/config/pricing";
import { getT } from "@/lib/i18n/server";
import { packCounts } from "@/lib/packs";
import { getPricingConfig } from "@/lib/pricing-settings";
import { getCreditPackages } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const [creditPackages, cfg, { t }] = await Promise.all([getCreditPackages(), getPricingConfig(), getT()]);
  // What each pack covers is counted from its credits and the price list, never typed by hand.
  const plans = creditPackages.map((pkg) => ({ pkg, counts: packCounts(pkg.credits, cfg, IMAGE_CREDITS) }));

  return (
    <div className="py-10 md:py-16">
      <h1 className="text-center text-3xl font-semibold tracking-tight md:text-5xl">{t("pricing.title")}</h1>
      <p className="mt-3 text-center text-muted">
        {t("pricing.intro", { bonus: formatCredits(SIGNUP_BONUS_CREDITS) })}
      </p>

      <PricingPlans plans={plans} referenceSeconds={cfg.referenceSeconds} />
    </div>
  );
}
