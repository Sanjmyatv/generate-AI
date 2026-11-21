"use client";

import Link from "next/link";
import { useLocale, useT } from "@/components/I18nProvider";
import { LazyVideo } from "@/components/LazyVideo";
import { Reveal } from "@/components/Reveal";
import { shapeOf } from "@/components/TemplateCard";
import { formatCredits } from "@/config/pricing";
import { templateDescription, templateName } from "@/lib/i18n/content";
import type { Template } from "@/types";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/**
 * The home page's Trending section: one template, big, with "Туршиж үзэх". The admin chooses it ("Set as Trending");
 * otherwise it is the most-used template of the moment. Video or image, in its own shape.
 */
export function TrendingSpotlight({ template, label }: { template: Template; label: string }) {
  const t = useT();
  const locale = useLocale();
  const name = templateName(template, locale);
  const description = templateDescription(template, locale);
  const shape = shapeOf(template.aspectRatio);
  const src = template.previewUrl;
  const isVideo = template.type === "video";
  const href = `/templates/${template.id}`;

  const tags = [
    isVideo ? t("card.kindVideo") : t("card.kindImage"),
    isVideo && template.durationSeconds
      ? t("card.seconds", { count: template.durationSeconds })
      : t("card.photo", { count: template.requiredPhotoCount }),
    t("card.credit", { count: Math.ceil(template.creditCost), amount: formatCredits(template.creditCost) }),
  ];

  return (
    <section id="trending" className="scroll-mt-24 pb-[clamp(56px,8vw,96px)]">
      <Reveal className="relative overflow-hidden rounded-[32px] border border-white/12 bg-white/6 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_30px_80px_rgba(0,0,0,0.4)] backdrop-blur-[24px] sm:p-4 md:p-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 size-[420px] rounded-full bg-[radial-gradient(circle,rgba(47,91,255,0.45),transparent_65%)] blur-2xl"
        />
        <div className={`relative grid items-center gap-6 md:gap-10 ${shape.wide ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" : "md:grid-cols-[auto_minmax(0,1fr)]"}`}>
          <Link
            href={href}
            aria-label={name}
            data-tilt="6"
            className={`glass-frame relative mx-auto block overflow-hidden rounded-[26px] p-[5px] ${
              shape.wide ? "w-full" : "h-[min(118vw,560px)] max-w-full md:h-[clamp(400px,40vw,560px)]"
            }`}
            style={{ aspectRatio: shape.css }}
          >
            <div className="relative size-full overflow-hidden rounded-[21px] bg-brand/20">
              {src && VIDEO_EXT.test(src) ? (
                <LazyVideo src={src} poster={template.posterUrl} label={name} playing fill />
              ) : src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={name} loading="lazy" className="absolute inset-0 size-full object-cover" />
              ) : null}
            </div>
            <div className="tilt-glow" />
          </Link>

          <div className="flex flex-col items-start gap-4 px-2 pb-3 md:gap-5 md:px-0 md:pb-0 md:pr-6">
            <span className="rounded-full bg-[linear-gradient(135deg,#ff9a3d,#ff4d4d)] px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-white shadow-[0_0_18px_rgba(255,110,60,0.55)]">
              🔥 {label}
            </span>
            <h2 className="text-balance text-[clamp(28px,4vw,52px)] font-bold leading-[1.05] tracking-[-0.04em]">{name}</h2>
            {description && <p className="max-w-[520px] text-pretty text-[16px] font-light leading-[1.6] text-foreground/70">{description}</p>}
            <ul className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <li key={tag} className="glass-chip rounded-full px-3 py-1.5 text-[13px] font-medium">
                  {tag}
                </li>
              ))}
            </ul>
            <Link href={href} data-mag="" className="btn-primary mt-1 max-md:w-full">
              {t("trend.try")} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
