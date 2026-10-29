import { PricingPlans } from "@/components/PricingPlans";
import { Reveal } from "@/components/Reveal";
import {
  IMAGE_CREDITS,
  SIGNUP_BONUS_CREDITS,
  VIDEO_CREDITS,
  formatCredits,
} from "@/config/pricing";
import { getCreditPackages } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const creditPackages = await getCreditPackages();

  return (
    <div className="py-10 md:py-16">
      <h1 className="text-center text-3xl font-semibold tracking-tight md:text-5xl">Pricing</h1>
      <p className="mt-3 text-center text-muted">
        Buy credits once and spend them on any video or image. 1 credit = 1₮. New Google and Apple accounts get{" "}
        {formatCredits(SIGNUP_BONUS_CREDITS)} free credits.
      </p>

      <PricingPlans packages={creditPackages} />

      <Reveal className="mt-12 rounded-3xl border border-line bg-surface p-6">
        <h2 className="text-lg font-semibold">What a creation costs</h2>
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-muted">Image</p>
            <p className="mt-1 text-[15px]">{formatCredits(IMAGE_CREDITS)} credits</p>
          </div>
          {([10, 20] as const).map((seconds) => (
            <div key={seconds}>
              <p className="text-muted">{seconds}-second video</p>
              <p className="mt-1 text-[15px]">
                {formatCredits(VIDEO_CREDITS[seconds]["480p"])} credits at 480p
                <span className="block text-muted">
                  {formatCredits(VIDEO_CREDITS[seconds]["720p"])} credits at 720p HD
                </span>
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted">
          Videos default to 480p (fast and eco); switch to 720p HD before you generate. If a generation fails, the
          credits are returned automatically.
        </p>
      </Reveal>
    </div>
  );
}
