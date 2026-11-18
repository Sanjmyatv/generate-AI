import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Icon3D, icons } from "@/components/Icon3D";
import { LazyVideo } from "@/components/LazyVideo";
import { templateName } from "@/lib/i18n/content";
import { getT } from "@/lib/i18n/server";
import { Reveal } from "@/components/Reveal";
import type { Template } from "@/types";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/** A tilted glass frame around an example picture, drifting with scroll (data-speed) and leaning with the pointer. */
function SideCard({ src, speed, className, rotate }: { src: string; speed: number; className: string; rotate: string }) {
  return (
    <div data-speed={speed} className={`absolute h-[70%] w-[44%] ${className}`}>
      <div data-tilt="10" className={`glass-frame size-full rounded-[30px] p-1.5 ${rotate}`}>
        <div className="relative size-full overflow-hidden rounded-3xl">
          <Image src={src} alt="" fill sizes="(max-width: 768px) 40vw, 240px" priority className="object-cover" />
        </div>
        <div className="tilt-glow" style={{ "--glow-size": "320px" } as CSSProperties} />
      </div>
    </div>
  );
}

/** Design: zyro Home → hero. Copy on the left, three floating glass cards on the right; the middle one is a real template. */
export async function Hero({ featured }: { featured?: Template }) {
  const { t, locale } = await getT();
  const name = featured ? templateName(featured, locale) : "";
  const src = featured?.previewUrl;
  const meta = featured
    ? featured.type === "video"
      ? `${t("card.kindVideo")}${featured.durationSeconds ? ` · ${t("card.seconds", { count: featured.durationSeconds })}` : ""}`
      : `${t("card.kindImage")} · ${t("card.photo", { count: featured.requiredPhotoCount })}`
    : "";

  const mainCard = (
    <div data-tilt="8" className="glass-frame relative size-full rounded-[36px] border-white/22 bg-white/10 p-[7px] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_40px_90px_rgba(0,0,0,0.6),0_0_80px_rgba(47,91,255,0.3)] backdrop-blur-[30px]">
      <div className="relative size-full overflow-hidden rounded-[29px]">
        {src && VIDEO_EXT.test(src) ? (
          <LazyVideo src={src} poster={featured?.posterUrl} label={name} playing fill />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src ?? "/brand/feature-panel.jpg"} alt="" className="absolute inset-0 size-full object-cover" />
        )}
      </div>
      <div className="tilt-glow" />
      {featured && (
        <div className="glass-chip pointer-events-none absolute inset-x-[18px] bottom-[18px] flex items-center justify-between gap-2.5 rounded-[22px] py-2.5 pl-4 pr-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[14px] font-semibold">{name}</span>
            <span className="text-[12px] text-foreground/65">{meta}</span>
          </div>
          <span className="grid size-[38px] flex-none place-items-center rounded-full bg-[linear-gradient(145deg,var(--brand-light),var(--brand))] text-[12px] text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.5),0_0_20px_rgba(47,91,255,0.8)]">
            ▶
          </span>
        </div>
      )}
    </div>
  );

  return (
    <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,440px),1fr))] items-center gap-12 pb-[clamp(48px,8vw,88px)] pt-[clamp(40px,9vw,96px)]">
      <div className="flex flex-col gap-7">
        <Reveal className="flex items-center gap-2.5 self-start rounded-full border border-white/12 bg-white/6 py-[7px] pl-2 pr-3.5 text-[13px] font-medium backdrop-blur-[20px]">
          <span className="rounded-full bg-[linear-gradient(135deg,var(--brand-light),var(--brand))] px-[9px] py-[3px] text-[11px] font-bold text-white shadow-[0_0_14px_rgba(47,91,255,0.7)]">
            AI
          </span>
          <span className="text-foreground/80">{t("hero.badge")}</span>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="text-balance text-[clamp(44px,6.4vw,84px)] font-bold leading-none tracking-[-0.045em]">
            {t("hero.title1")} <span className="text-gradient">{t("hero.title2")}</span>
            {t("hero.title3")}
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="max-w-[480px] text-pretty text-[18px] font-light leading-[1.6] text-foreground/70">{t("hero.desc")}</p>
        </Reveal>
        <Reveal delay={240} className="flex flex-wrap gap-3">
          <Link href="#discover" data-mag="" className="btn-primary">
            {t("hero.explore")} <span className="text-[18px]">→</span>
          </Link>
          <Link href="#how" data-mag="" className="btn-glass">
            {t("hero.how")}
          </Link>
        </Reveal>
      </div>

      <Reveal delay={200} className="relative h-[clamp(440px,118vw,580px)]">
        <SideCard src="/brand/hero-left.jpg" speed={0.14} className="left-[3%] top-[12%]" rotate="-rotate-[7deg]" />
        <SideCard src="/brand/hero-right.jpg" speed={0.24} className="right-[3%] top-[17%]" rotate="rotate-[7deg]" />
        <div data-speed="0.06" className="absolute left-[24%] top-[3%] h-[88%] w-[52%]">
          {featured ? (
            <Link href={`/templates/${featured.id}`} aria-label={name} className="block size-full rounded-[36px]">
              {mainCard}
            </Link>
          ) : (
            mainCard
          )}
        </div>
        <div data-speed="0.42" className="pointer-events-none absolute right-[-6px] top-0.5 z-[3]">
          <Icon3D size={64} radius={20}>{icons.play(26)}</Icon3D>
        </div>
        <div data-speed="0.32" className="pointer-events-none absolute bottom-10 left-[-4px] z-[3]">
          <Icon3D size={58} radius={18} delay={2} flip>
            {icons.sparkles(26)}
          </Icon3D>
        </div>
      </Reveal>
    </section>
  );
}
