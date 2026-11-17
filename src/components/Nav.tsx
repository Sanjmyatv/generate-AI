"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/actions/auth";
import { useT } from "@/components/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LoginModal } from "@/components/LoginModal";
import { Logo } from "@/components/Logo";
import { QPayModal } from "@/components/QPayModal";
import { formatCredits } from "@/config/pricing";
import type { CreditPackage } from "@/types";

export interface NavUser {
  name: string | null;
  email: string | null;
  credits: number;
}

// Figma: zyro.ai / Navigation. The profile lives in the user menu, not in this row.
const links = [
  { href: "/", label: "nav.explore" },
  { href: "/?media=videos#discover", label: "nav.videos" },
  { href: "/?media=images#discover", label: "nav.images" },
  { href: "/pricing", label: "nav.pricing" },
  { href: "/history", label: "nav.history" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href.startsWith("/?")) return false;
  return pathname.startsWith(href);
}

function initialsOf(user: NavUser) {
  const source = (user.name || user.email || "?").trim();
  const words = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

const menuItemClass =
  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-white/10";

export function Nav({ user }: { user: NavUser | null }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authRedirect, setAuthRedirect] = useState("/");
  const [profileOpen, setProfileOpen] = useState(false);
  const [packages, setPackages] = useState<CreditPackage[] | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // The bar gets stronger (more blur, a more solid fill, a shadow) once the page scrolls a few pixels.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    const frame = requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // The user menu closes on an outside click or Escape.
  useEffect(() => {
    if (!profileOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setProfileOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileOpen]);

  function openLogin() {
    // After signing in, come back to the page the visitor was on.
    setAuthRedirect(window.location.pathname + window.location.search);
    setOpen(false);
    setAuthOpen(true);
  }

  async function openTopUp() {
    setProfileOpen(false);
    try {
      const res = await fetch("/api/packages", { cache: "no-store" });
      const data = (await res.json()) as { packages: CreditPackage[] };
      setPackages(data.packages);
    } catch {
      router.push("/pricing"); // the pricing page is the fallback if the packs can't load
    }
  }

  const header = (
    <>
      {/* A fixed, floating glass pill: it blurs what scrolls under it and gets stronger after a few pixels. */}
      <header
        data-scrolled={scrolled || open}
        className="glass-bar-wrap fixed inset-x-0 top-0 z-40 px-3 sm:px-5 [padding-top:max(0.75rem,env(safe-area-inset-top))]"
      >
        <div className="glass-bar mx-auto flex h-16 max-w-[1280px] items-center justify-between rounded-full px-3 pl-5 sm:px-4 sm:pl-6">
          <Link href="/" aria-label={t("nav.homeLabel")} onClick={() => setOpen(false)}>
            <Logo />
          </Link>

          <nav aria-label={t("nav.mainLabel")} className="hidden items-center gap-1 text-[14px] md:flex">
            {links.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`${item.href === "/history" ? "hidden lg:inline-flex " : "inline-flex "}min-h-10 items-center px-4 transition-colors ${
                    active ? "chip-brand" : "rounded-full text-muted hover:bg-white/10 hover:text-foreground"
                  }`}
                >
                  {t(item.label)}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-3">
            <LanguageSwitcher />
            {user ? (
              <div ref={profileRef} className="relative">
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={profileOpen}
                  onClick={() => setProfileOpen((v) => !v)}
                  className="btn-glass flex !min-h-11 items-center !gap-2.5 !py-1 !pl-1 !pr-3"
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-brand text-[12px] font-semibold text-white">
                    {initialsOf(user)}
                  </span>
                  <span className="hidden max-w-[140px] truncate text-[14px] font-medium sm:inline">{user.name || user.email}</span>
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                    className={`size-4 text-zinc-400 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {profileOpen && (
                  <div
                    role="menu"
                    className="glass-panel animate-pop-in absolute right-0 top-[calc(100%+10px)] w-72 origin-top-right rounded-3xl p-2"
                  >
                    <div className="px-3 pb-3 pt-2">
                      <p className="truncate text-sm font-medium text-foreground">{user.name || user.email}</p>
                      {user.name && user.email && <p className="truncate text-xs text-zinc-400">{user.email}</p>}
                    </div>

                    <div className="mx-1 mb-2 flex items-center justify-between rounded-2xl border border-brand/30 bg-brand/10 px-3 py-2.5">
                      <span className="text-sm text-foreground">⚡ {t("nav.creditsLine", { amount: formatCredits(user.credits) })}</span>
                      <button
                        type="button"
                        onClick={() => void openTopUp()}
                        className="text-sm font-medium text-brand-light underline-offset-2 hover:underline"
                      >
                        {t("nav.topUp")}
                      </button>
                    </div>

                    <Link href="/profile" role="menuitem" onClick={() => setProfileOpen(false)} className={menuItemClass}>
                      <span aria-hidden="true">👤</span> {t("nav.profile")}
                    </Link>
                    <Link href="/history" role="menuitem" onClick={() => setProfileOpen(false)} className={menuItemClass}>
                      <span aria-hidden="true">🎬</span> {t("nav.generationHistory")}
                    </Link>
                    <Link
                      href="/profile#settings"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className={menuItemClass}
                    >
                      <span aria-hidden="true">⚙️</span> {t("nav.settings")}
                    </Link>

                    <div className="mx-1 my-2 border-t border-line" />
                    <form action={signOutAction}>
                      <button
                        type="submit"
                        role="menuitem"
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-danger transition hover:bg-danger/10"
                      >
                        <span aria-hidden="true">↩</span> {t("nav.logOut")}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ) : (
              <button type="button" onClick={openLogin} className="btn-primary !px-5 !py-2.5">
                {t("nav.logIn")}
              </button>
            )}

            <button
              type="button"
              aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="flex size-11 items-center justify-center rounded-full hover:bg-white/10 md:hidden"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={open ? "/brand/icon-x.svg" : "/brand/icon-menu.svg"} alt="" className="size-5" />
            </button>
          </div>
        </div>

        {open && (
          <nav
            aria-label={t("nav.mobileLabel")}
            className="glass-panel animate-pop-in mx-auto mt-2 flex max-w-[1280px] flex-col gap-1 rounded-3xl p-3 md:hidden"
          >
            {links.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-12 items-center justify-between rounded-2xl px-4 text-[17px] ${
                    active ? "bg-brand text-white shadow-[0_0_16px_var(--glow)]" : "text-foreground hover:bg-white/10"
                  }`}
                >
                  {t(item.label)}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/icon-arrow-up-right-lg.svg" alt="" className="size-[18px]" />
                </Link>
              );
            })}
          </nav>
        )}
      </header>
      {/* The bar floats above the page, so this keeps the content from starting underneath it. */}
      <div aria-hidden="true" className="h-[88px] [padding-top:env(safe-area-inset-top)]" />
    </>
  );

  return (
    <>
      {header}
      {/* Outside the header: its backdrop blur would otherwise make "fixed" mean "inside the header". */}
      {authOpen && <LoginModal redirectTo={authRedirect} onClose={() => setAuthOpen(false)} />}
      {packages && <QPayModal packages={packages} balance={user?.credits} onClose={() => setPackages(null)} />}
    </>
  );
}
