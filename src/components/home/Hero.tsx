import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { HeroScene } from "@/components/home/HeroScene";
import { getT } from "@/lib/i18n/server";

/** Figma: zyro.ai · Desktop / Tablet / Mobile homepage → Hero, over an animated backdrop. */
export async function Hero() {
  const { t } = await getT();
  return (
    <section className="relative isolate pb-0 pt-12 md:pt-14 lg:pt-[94px]">
      <HeroScene />

      <div className="flex flex-col gap-8 xl:flex-row xl:items-center xl:gap-10">
        <div className="flex w-full flex-col items-start gap-6 xl:w-[730px] xl:shrink-0">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/dot-available.svg" alt="" className="size-[5px]" />
            <p className="text-[9px] leading-[1.5] text-muted md:text-[10px]">
              {t("hero.eyebrow")}
            </p>
          </div>

          <h1 className="text-[40px] font-semibold leading-[1.08] tracking-[-1.8px] text-foreground md:text-[68px] md:tracking-[-3.5px] xl:text-[76px]">
            {t("hero.title1")}
            <br />
            <span className="bg-linear-to-r from-violet-300 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">
              {t("hero.title2")}
            </span>
          </h1>

          <p className="text-[15px] leading-[1.5] text-muted md:text-[17px] lg:w-[580px]">
            {t("hero.desc")}
          </p>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row md:pt-2">
            <Link
              href="#discover"
              className="btn-primary flex h-[54px] items-center justify-center gap-[10px] px-7 text-[14px] font-medium"
            >
              {t("hero.explore")}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/icon-arrow-up-right.svg" alt="" className="size-4" />
            </Link>
            <Link
              href="#trending"
              className="btn-glass flex h-[54px] items-center justify-center gap-[10px] px-7 text-[14px] font-medium"
            >
              {t("hero.possible")}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/icon-play.svg" alt="" className="size-4" />
            </Link>
          </div>

          <p className="text-[11px] leading-[1.5] text-muted">{t("hero.note")}</p>
        </div>

        {/* Two example results, framed in glass and floating over the backdrop. Laid out at 530x460 and scaled down on phones. */}
        <div className="relative h-[300px] w-[350px] shrink-0 sm:h-[460px] sm:w-[530px] md:w-[620px] xl:w-[530px]">
          <div className="absolute left-0 top-0 h-[460px] w-[530px] origin-top-left scale-[0.66] sm:scale-100">
            <div className="hs-layer left-[40px] top-[56px]" style={{ "--d": 30 } as CSSProperties}>
              <div className="hs-float" style={{ "--dur": "9s", "--delay": "-2s" } as CSSProperties}>
                <div className="relative h-[310px] w-[184px] -rotate-[8deg] overflow-hidden rounded-3xl border border-white/25 shadow-[0_0_46px_rgba(99,102,241,0.45)]">
                  <Image
                    src="/brand/hero-cinematic.jpg"
                    alt=""
                    fill
                    sizes="184px"
                    priority
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-tr from-indigo-500/10 via-transparent to-cyan-300/15" />
                </div>
              </div>
            </div>

            <div className="hs-layer left-[290px] top-[24px]" style={{ "--d": 46 } as CSSProperties}>
              <div className="hs-float" style={{ "--dur": "11s", "--delay": "-6s" } as CSSProperties}>
                <div className="relative h-[266px] w-[162px] rotate-[8deg] overflow-hidden rounded-3xl border border-white/25 shadow-[0_0_46px_rgba(59,130,246,0.45)]">
                  <Image src="/brand/hero-fashion.jpg" alt="" fill sizes="162px" priority className="object-cover" />
                  <div className="absolute inset-0 bg-linear-to-tl from-violet-500/15 via-transparent to-cyan-300/10" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-7 flex justify-between whitespace-nowrap border-b border-line text-[10px] leading-[1.5] text-muted md:mt-[60px]">
        <p>{t("hero.bottomLeft")}</p>
        <p>{t("hero.bottomRight")}</p>
      </div>
    </section>
  );
}
