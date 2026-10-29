import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import type { Template } from "@/types";

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

/** Figma: zyro.ai / Featured template, a wide spotlight panel for one template. */
export function FeaturedTemplate({ template }: { template: Template }) {
  const src = template.previewUrl;

  return (
    <Reveal as="section" className="pb-5 pt-10 md:pt-16">
      <div className="relative flex h-[470px] flex-col justify-end overflow-hidden rounded-3xl p-[26px] md:h-[430px] md:p-12">
        {src && VIDEO_EXT.test(src) ? (
          <video src={src} autoPlay muted loop playsInline className="absolute inset-0 size-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src ?? "/brand/feature-panel.jpg"}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,17,0.94)_0%,rgba(7,7,17,0.5)_38.5%,rgba(7,7,17,0)_70%)] md:bg-[linear-gradient(90deg,rgba(7,7,17,0.94)_0%,rgba(7,7,17,0.5)_55%,rgba(7,7,17,0)_100%)]" />

        <div className="relative flex w-full flex-col items-start gap-4 md:max-w-[406px]">
          <p className="text-[10px] font-medium leading-[1.5] text-[#d7c6ff]">THE SPOTLIGHT IS YOURS</p>
          <h2 className="text-[34px] leading-[1.1] tracking-[-1.5px] text-foreground md:text-[46px]">
            {template.name}
          </h2>
          <p className="text-[14px] leading-[1.5] text-[#d3d0db]">{template.description}</p>
          <Link
            href={`/templates/${template.id}`}
            className="flex h-[54px] items-center justify-center gap-[10px] rounded-xl btn-primary px-6 text-[14px] text-foreground md:rounded-full md:shadow-[0_0_12px_1px_#4b0adc]"
          >
            Try This Template
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/icon-arrow-up-right.svg" alt="" className="size-4" />
          </Link>
        </div>
      </div>
    </Reveal>
  );
}
