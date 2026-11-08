import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { getT } from "@/lib/i18n/server";

const steps = [
  { icon: "/brand/icon-layout-grid.svg", title: "how.step1.title", text: "how.step1.text" },
  { icon: "/brand/icon-upload.svg", title: "how.step2.title", text: "how.step2.text" },
  { icon: "/brand/icon-sparkles.svg", title: "how.step3.title", text: "how.step3.text" },
] as const;

/** Figma: How it works (full-width band) and the pricing teaser panel below it. */
export async function HowItWorks() {
  const { t } = await getT();
  return (
    <>
      <section
        id="how-it-works"
        // The band is full width even though the page content is capped at 1440px.
        className="bg-secondary py-14 shadow-[0_0_0_100vmax_#0d0d1b] [clip-path:inset(0_-100vmax)] md:py-[88px]"
      >
        <Reveal className="flex flex-col gap-3">
          <p className="text-[10px] leading-[1.5] text-purple-label">{t("how.eyebrow")}</p>
          <h2 className="text-[30px] leading-[1.15] tracking-[-1.3px] text-foreground md:text-[40px]">
            {t("how.title")}
          </h2>
        </Reveal>
        <div className="mt-8 flex flex-col gap-10 md:mt-12 md:flex-row md:gap-12">
          {steps.map((step, index) => (
            <Reveal key={step.title} delay={index * 110} className="flex flex-1 flex-col gap-4">
              <div className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={step.icon} alt="" className="size-5" />
              </div>
              <h3 className="text-[19px] font-medium leading-[1.5] text-foreground">{t(step.title)}</h3>
              <p className="text-[14px] leading-[1.5] text-muted">{t(step.text)}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="py-14 md:py-[88px]">
        <Reveal className="flex flex-col items-center gap-6 rounded-3xl border border-[rgba(255,255,255,0.12)] bg-[linear-gradient(180deg,#19122d_0%,#101020_55%,#10172b_100%)] px-6 py-12 text-center md:p-16">
          <p className="text-[10px] leading-[1.5] text-purple-label">{t("how.cta.eyebrow")}</p>
          <h2 className="text-[32px] leading-[1.15] tracking-[-1.5px] text-foreground md:text-[46px]">
            {t("how.cta.title")}
          </h2>
          <p className="max-w-[510px] text-[15px] leading-[1.5] text-muted">
            {t("how.cta.desc")}
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            <Link
              href="/#discover"
              className="flex h-[54px] items-center justify-center gap-[10px] btn-primary px-7 text-[14px] font-medium"
            >
              {t("how.cta.start")}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/icon-arrow-up-right.svg" alt="" className="size-4" />
            </Link>
            <Link href="/pricing" className="flex h-11 items-center gap-2 text-[13px] text-foreground">
              {t("how.cta.pricing")}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/icon-arrow-right.svg" alt="" className="size-4" />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
