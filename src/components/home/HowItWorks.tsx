import Link from "next/link";
import { Icon3D, icons } from "@/components/Icon3D";
import { Reveal } from "@/components/Reveal";
import { getT } from "@/lib/i18n/server";

const steps = [
  { icon: icons.grid, title: "how.step1.title", text: "how.step1.text" },
  { icon: icons.upload, title: "how.step2.title", text: "how.step2.text" },
  { icon: icons.sparkles, title: "how.step3.title", text: "how.step3.text" },
] as const;

/** Design: zyro Home → three glass step cards with 3D icons. */
export async function HowItWorks() {
  const { t } = await getT();
  return (
    <section id="how" className="flex flex-col gap-9 pb-[clamp(64px,10vw,104px)] pt-[clamp(24px,4vw,40px)]">
      <Reveal>
        <h2 className="text-[clamp(30px,3.6vw,46px)] font-bold tracking-[-0.035em]">{t("how.title")}</h2>
      </Reveal>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-4">
        {steps.map((step, i) => (
          <Reveal key={step.title} delay={i * 120}>
            <div data-tilt="8" className="glass-card flex h-full flex-col gap-4 overflow-hidden rounded-[30px] p-[30px]">
              <div className="tilt-glow" style={{ background: "radial-gradient(380px circle at var(--mx, 50%) var(--my, 50%), rgba(47,91,255,0.22), transparent 60%)" }} />
              <Icon3D delay={i * 2} className="mb-1.5">
                {step.icon(30)}
              </Icon3D>
              <span className="relative text-[13px] font-semibold text-brand-light">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="relative text-[22px] font-semibold tracking-[-0.02em]">{t(step.title)}</h3>
              <p className="relative text-[15px] font-light leading-[1.6] text-foreground/66">{t(step.text)}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/** Design: zyro Home → the credits panel that leads to the pricing page. */
export async function PricingTeaser() {
  const { t } = await getT();
  return (
    <section id="pricing" className="pb-[clamp(64px,10vw,104px)]">
      <Reveal>
        <div
          data-tilt="4"
          className="glass-card flex flex-wrap items-center justify-between gap-8 overflow-hidden rounded-[clamp(28px,5vw,40px)] border-white/14 bg-white/[0.055] p-[clamp(28px,6vw,56px)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_30px_80px_rgba(0,0,0,0.4)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_30px_80px_rgba(0,0,0,0.4)]"
        >
          <div aria-hidden="true" className="pointer-events-none absolute right-[-120px] top-[-220px] size-[460px] rounded-full bg-brand opacity-40 blur-[110px]" />
          <div className="tilt-glow" style={{ background: "radial-gradient(500px circle at var(--mx, 50%) var(--my, 50%), rgba(47,91,255,0.22), transparent 60%)" }} />
          <div className="relative flex max-w-[680px] flex-wrap items-center gap-7">
            <Icon3D size={84} round>
              {icons.bolt(34)}
            </Icon3D>
            <div className="flex min-w-[260px] flex-1 flex-col gap-3">
              <h2 className="text-balance text-[clamp(28px,3.4vw,42px)] font-bold tracking-[-0.035em]">{t("how.cta.title")}</h2>
              <p className="text-[16px] font-light leading-[1.6] text-foreground/68">{t("how.cta.desc")}</p>
            </div>
          </div>
          <Link href="/pricing" data-mag="" className="btn-primary relative !px-7">
            {t("how.cta.pricing")} →
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
