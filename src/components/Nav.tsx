"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";

// Figma: zyro.ai / Navigation. History and Profile are kept after the design's four links.
const links = [
  { href: "/", label: "Explore" },
  { href: "/?media=videos#discover", label: "Videos" },
  { href: "/?media=images#discover", label: "Images" },
  { href: "/pricing", label: "Pricing" },
];
const accountLinks = [
  { href: "/history", label: "History" },
  { href: "/profile", label: "Profile" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href.startsWith("/?")) return false;
  return pathname.startsWith(href);
}

export function Nav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Transparent over the hero, opaque once the page scrolls.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    const frame = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const opaque = scrolled || open;
  const cta = signedIn ? "Create" : "Create for Free";

  return (
    <header
      className={`sticky top-0 z-40 border-b border-line backdrop-blur-[12px] transition-colors ${
        opaque ? "bg-secondary" : "bg-[rgba(7,7,17,0.67)]"
      }`}
    >
      <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 md:h-[88px] md:px-8 lg:px-16">
        <Link href="/" aria-label="zyro.ai home" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-9 text-[13px] md:flex">
          {links.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={isActive(pathname, item.href) ? "text-foreground" : "text-muted hover:text-foreground"}
            >
              {item.label}
            </Link>
          ))}
          {accountLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`hidden lg:inline ${
                isActive(pathname, item.href) ? "text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/#discover"
            onClick={() => setOpen(false)}
            className="flex h-[42px] items-center justify-center rounded-xl border border-line bg-purple px-4 text-[12px] text-foreground md:rounded-full"
          >
            {cta}
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-11 w-9 items-center justify-center md:hidden"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open ? "/brand/icon-x.svg" : "/brand/icon-menu.svg"} alt="" className="size-5" />
          </button>
        </div>
      </div>

      {open && (
        <nav aria-label="Mobile" className="flex flex-col gap-2 px-5 pb-8 pt-5 md:hidden">
          {[...links, ...accountLinks].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex h-[52px] items-center justify-between text-[18px] text-foreground"
            >
              {item.label}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/icon-arrow-up-right-lg.svg" alt="" className="size-[18px]" />
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
