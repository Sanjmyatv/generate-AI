import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getT } from "@/lib/i18n/server";
import type { TKey } from "@/lib/i18n/translate";

// Design: zyro Home → footer.
const groups: { title: TKey; items: { label: TKey; href: string }[] }[] = [
  {
    title: "footer.explore",
    items: [
      { label: "footer.videos", href: "/#videos" },
      { label: "footer.images", href: "/#images" },
      { label: "footer.trending", href: "/#videos" },
    ],
  },
  {
    title: "footer.info",
    items: [
      { label: "footer.about", href: "/about" },
      { label: "footer.terms", href: "/terms" },
      { label: "footer.privacy", href: "/privacy" },
    ],
  },
];

// The official accounts.
const socials = [
  { label: "Instagram", href: "https://www.instagram.com/zyroai_mn" },
  {
    label: "Facebook",
    href: "https://www.facebook.com/people/Zyro-AI-%D0%B2%D0%B8%D0%B4%D0%B5%D0%BE-%D0%B7%D1%83%D1%80%D0%B0%D0%B3/61596146735212/",
  },
  { label: "TikTok", href: "https://www.tiktok.com/@zyroai_mn" },
];

export async function Footer() {
  const { t } = await getT();
  return (
    <footer className="relative border-t border-white/8 bg-[rgba(4,6,15,0.4)] backdrop-blur-[20px]">
      <div className="mx-auto grid max-w-[1180px] grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-10 px-5 pb-10 pt-[clamp(40px,7vw,56px)]">
        <div className="col-span-full flex flex-col gap-4 md:col-span-2">
          <Link href="/" className="self-start">
            <Logo />
          </Link>
          <p className="max-w-[300px] text-[14px] font-light text-foreground/58">{t("footer.tagline")}</p>
          <div className="flex flex-wrap gap-2">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/10 bg-white/7 px-3.5 py-[9px] text-[13px] font-medium transition-all duration-300 hover:border-brand-light/50 hover:bg-brand/35"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>

        {groups.map((group) => (
          <div key={group.title} className="flex flex-col gap-3 text-[14px]">
            <span className="font-semibold">{t(group.title)}</span>
            {group.items.map((item) => (
              <Link key={item.label} href={item.href} className="text-foreground/60 transition-colors duration-200 hover:text-white">
                {t(item.label)}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-[1180px] p-5 text-[13px] text-foreground/45">{t("footer.rights")}</div>
    </footer>
  );
}
