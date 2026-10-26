import Link from "next/link";
import { Logo } from "@/components/Logo";

// Figma: zyro.ai / Footer. Entries without a page of their own are plain text, not dead links.
const groups: { title: string; items: { label: string; href?: string }[] }[] = [
  {
    title: "Explore",
    items: [
      { label: "Videos", href: "/?media=videos#discover" },
      { label: "Images", href: "/?media=images#discover" },
      { label: "Trending Templates", href: "/#trending" },
    ],
  },
  { title: "Company", items: [{ label: "About" }, { label: "Contact" }] },
  { title: "Legal", items: [{ label: "Terms of Service" }, { label: "Privacy Policy" }] },
];

const socials = [
  { label: "Instagram", icon: "/brand/icon-instagram.svg", framed: true },
  { label: "Facebook", icon: "/brand/icon-facebook.svg", framed: true },
  { label: "TikTok", icon: "/brand/icon-tiktok.svg", framed: false },
];

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1440px] px-5 pb-8 pt-12 md:px-8 md:pt-[72px] lg:px-16">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
          <div className="flex w-full max-w-[280px] flex-col gap-5">
            <Logo />
            <p className="text-[14px] leading-[1.5] text-muted">
              Your creative playground for AI-generated videos and images.
            </p>
            <div className="flex gap-3">
              {socials.map((s) => (
                <span
                  key={s.label}
                  role="img"
                  aria-label={s.label}
                  className={`flex size-10 items-center justify-center rounded-full ${
                    s.framed ? "border border-line bg-surface" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.icon} alt="" className={s.framed ? "size-[18px]" : "size-10"} />
                </span>
              ))}
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-x-12 gap-y-10 sm:grid-cols-3 lg:w-[660px]">
            {groups.map((group) => (
              <div key={group.title} className="flex flex-col gap-[14px] leading-[1.5]">
                <p className="text-[13px] text-foreground">{group.title}</p>
                {group.items.map((item) =>
                  item.href ? (
                    <Link key={item.label} href={item.href} className="text-[12px] text-muted hover:text-foreground">
                      {item.label}
                    </Link>
                  ) : (
                    <span key={item.label} className="text-[12px] text-muted">
                      {item.label}
                    </span>
                  ),
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-line pt-6 text-[10px] leading-[1.5] text-muted sm:flex-row sm:justify-between md:mt-16">
          <p>© 2026 zyro.ai. All rights reserved.</p>
          <p>CREATE BEYOND REALITY</p>
        </div>
      </div>
    </footer>
  );
}
