import Image from "next/image";
import Link from "next/link";

/** Figma: zyro.ai · Desktop / Tablet / Mobile homepage → Hero. */
export function Hero() {
  return (
    <section className="pb-0 pt-12 md:pt-14 lg:pt-[94px]">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-10">
        <div className="flex w-full flex-col items-start gap-6 lg:w-[730px] lg:shrink-0">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/dot-available.svg" alt="" className="size-[5px]" />
            <p className="text-[9px] leading-[1.5] text-muted md:text-[10px]">
              AI VIDEO &amp; IMAGE GENERATION · READY-TO-USE TEMPLATES
            </p>
          </div>

          <h1 className="text-[40px] font-semibold leading-[1.08] tracking-[-1.8px] text-foreground md:text-[68px] md:tracking-[-3.5px] lg:text-[76px]">
            Your imagination.
            <br />
            Without limits.
          </h1>

          <p className="text-[15px] leading-[1.5] text-muted md:text-[17px] lg:w-[580px]">
            Turn your photos into incredible AI videos and images. Choose a template, upload your photo, and let
            zyro.ai do the magic.
          </p>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row md:pt-2">
            <Link
              href="#discover"
              className="flex h-[54px] items-center justify-center gap-[10px] rounded-xl border border-line bg-purple px-6 text-[14px] text-foreground"
            >
              Explore Templates
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/icon-arrow-up-right.svg" alt="" className="size-4" />
            </Link>
            <Link
              href="#trending"
              className="flex h-[54px] items-center justify-center gap-[10px] rounded-xl border border-line bg-surface px-6 text-[14px] text-foreground"
            >
              See What’s Possible
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/icon-play.svg" alt="" className="size-4" />
            </Link>
          </div>

          <p className="text-[11px] leading-[1.5] text-muted">No complicated prompts. Just you, reimagined.</p>
        </div>

        {/* Imagination preview: laid out at 530x460 and scaled down on phones. */}
        <div className="relative h-[300px] w-[350px] shrink-0 sm:h-[460px] sm:w-[530px] md:w-[620px] lg:w-[530px]">
          <div className="absolute left-0 top-0 h-[460px] w-[530px] origin-top-left scale-[0.66] sm:scale-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/hero-atmosphere.svg" alt="" className="absolute inset-0 size-full" />

            <div className="absolute left-3 top-[27.22px] flex h-[334.967px] w-[230.229px] items-center justify-center">
              <div className="relative h-[310px] w-[184px] shrink-0 rotate-[-9deg] overflow-hidden rounded-2xl">
                <Image
                  src="/brand/hero-cinematic.jpg"
                  alt=""
                  fill
                  sizes="184px"
                  priority
                  className="object-cover"
                />
              </div>
            </div>

            <div className="absolute left-[312.39px] top-3 flex h-[288.067px] w-[201.617px] items-center justify-center">
              <div className="relative h-[266px] w-[162px] shrink-0 rotate-[9deg] overflow-hidden rounded-2xl">
                <Image src="/brand/hero-fashion.jpg" alt="" fill sizes="162px" priority className="object-cover" />
              </div>
            </div>

            <div className="absolute left-[164px] top-[100px] h-[264.063px] w-[260px]">
              <Image
                src="/brand/z-emblem.png"
                alt=""
                width={520}
                height={528}
                priority
                className="size-full object-cover"
              />
            </div>

            <div className="absolute left-[187px] top-[390px] flex items-center gap-[7px] rounded-full border border-line bg-[rgba(18,18,37,0.8)] px-3 py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/icon-sparkles-sm.svg" alt="" className="size-[13px]" />
              <p className="whitespace-nowrap text-[10px] leading-[1.5] text-foreground">
                One photo. Infinite possibilities.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-7 flex justify-between whitespace-nowrap border-b border-line text-[10px] leading-[1.5] text-muted md:mt-[60px]">
        <p>MADE FROM YOUR IMAGINATION</p>
        <p>SCROLL TO EXPLORE ↓</p>
      </div>
    </section>
  );
}
