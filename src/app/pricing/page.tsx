import { PricingPlans } from "@/components/PricingPlans";
import { Reveal } from "@/components/Reveal";
import {
  IMAGE_CREDITS,
  SIGNUP_BONUS_CREDITS,
  VIDEO_CREDITS,
  formatCredits,
} from "@/config/pricing";
import { getT } from "@/lib/i18n/server";
import { getCreditPackages } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const [creditPackages, { t }] = await Promise.all([getCreditPackages(), getT()]);

  return (
    <div className="py-10 md:py-16">
      <h1 className="text-center text-3xl font-semibold tracking-tight md:text-5xl">{t("pricing.title")}</h1>
      <p className="mt-3 text-center text-muted">
        {t("pricing.intro", { bonus: formatCredits(SIGNUP_BONUS_CREDITS) })}
      </p>

      <PricingPlans packages={creditPackages} />

      <Reveal className="mt-12 rounded-3xl border border-line bg-surface p-6">
        <h2 className="text-lg font-semibold">{t("pricing.costTitle")}</h2>
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted">{t("pricing.image")}</p>
            <p className="mt-1 text-[15px]">{t("pricing.credits", { amount: formatCredits(IMAGE_CREDITS) })}</p>
          </div>
          {([10, 20] as const).map((seconds) => (
            <div key={seconds}>
              <p className="text-muted">{t("pricing.videoSeconds", { seconds })}</p>
              <p className="mt-1 text-[15px]">
                {t("pricing.at480", { amount: formatCredits(VIDEO_CREDITS[seconds]["480p"]) })}
                <span className="block text-muted">
                  {t("pricing.at720", { amount: formatCredits(VIDEO_CREDITS[seconds]["720p"]) })}
                </span>
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">
          {t("pricing.note")}
        </p>
      </Reveal>
    </div>
  );
}
