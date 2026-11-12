import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getT } from "@/lib/i18n/server";
import type { TKey } from "@/lib/i18n/translate";

// Figma: zyro.ai / Footer. Entries without a page of their own are plain text, not dead links.
const groups: { title: TKey; items: { label: TKey; href?: string }[] }[] = [
  {
    title: "footer.explore",
    items: [
      { label: "footer.videos", href: "/?media=videos#discover" },
      { label: "footer.images", href: "/?media=images#discover" },
      { label: "footer.trending", href: "/#trending" },
    ],
  },
  { title: "footer.company", items: [{ label: "footer.about" }] },
  { title: "footer.legal", items: [{ label: "footer.terms" }, { label: "footer.privacy" }] },
];

// The official accounts. The TikTok address follows the Instagram handle: change it here if the account differs.
const socials = [
  { label: "Instagram", href: "https://www.instagram.com/zyroai_mn", icon: "/brand/icon-instagram.svg", framed: true },
  {
    label: "Facebook",
    href: "https://www.facebook.com/people/Zyro-AI-%D0%B2%D0%B8%D0%B4%D0%B5%D0%BE-%D0%B7%D1%83%D1%80%D0%B0%D0%B3/61596146735212/",
    icon: "/brand/icon-facebook.svg",
    framed: true,
  },
  { label: "TikTok", href: "https://www.tiktok.com/@zyroai_mn", icon: "/brand/icon-tiktok.svg", framed: false },
];

export async function Footer() {
  const { t } = await getT();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1440px] px-5 pb-8 pt-12 md:px-8 md:pt-[72px] lg:px-16">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
          <div className="flex w-full max-w-[280px] flex-col gap-5">
            <Logo />
            <p className="text-[14px] leading-[1.5] text-muted">
              {t("footer.tagline")}
            </p>
            <div className="flex gap-3">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className={`flex size-10 items-center justify-center rounded-full opacity-80 transition duration-200 hover:scale-110 hover:opacity-100 hover:shadow-[0_0_18px_rgba(99,102,241,0.45)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:shadow-[0_0_18px_rgba(99,102,241,0.45)] ${
                    s.framed ? "border border-line bg-surface hover:border-indigo-400/60" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.icon} alt="" className={s.framed ? "size-[18px]" : "size-10"} />
                </a>
              ))}
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-x-12 gap-y-10 sm:grid-cols-3 lg:w-[660px]">
            {groups.map((group) => (
              <div key={group.title} className="flex flex-col gap-[14px] leading-[1.5]">
                <p className="text-[13px] text-foreground">{t(group.title)}</p>
                {group.items.map((item) =>
                  item.href ? (
                    <Link key={item.label} href={item.href} className="text-[12px] text-muted hover:text-foreground">
                      {t(item.label)}
                    </Link>
                  ) : (
                    <span key={item.label} className="text-[12px] text-muted">
                      {t(item.label)}
                    </span>
                  ),
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-line pt-6 text-[10px] leading-[1.5] text-muted sm:flex-row sm:justify-between md:mt-16">
          <p>{t("footer.rights")}</p>
          <p>{t("footer.slogan")}</p>
        </div>
      </div>
    </footer>
  );
}
