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
  { href: "/templates?type=video", label: "nav.videos" },
  { href: "/templates?type=image", label: "nav.images" },
  { href: "/pricing", label: "nav.pricing" },
  { href: "/history", label: "nav.history" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href.includes("?")) return false; // the template list's Video / Image links: the page shows its own tabs
  return pathname.startsWith(href);
}

function initialsOf(user: NavUser) {
  const source = (user.name || user.email || "?").trim();
  const words = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}

const menuItemClass =
  "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground/90 transition hover:bg-white/10";

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
    // Full-width liquid-glass bar that stays at the top; the page scrolls under its blur.
    <header
      data-scrolled={scrolled || open}
      className="glass-bar-wrap sticky top-0 z-40 [padding-top:env(safe-area-inset-top)]"
    >
      <div className="glass-bar flex w-full items-center justify-between gap-3 px-3 py-2.5 sm:px-5 lg:px-8">
        <Link href="/" aria-label={t("nav.homeLabel")} onClick={() => setOpen(false)} className="flex flex-none items-center">
          <Logo />
        </Link>

        <nav aria-label={t("nav.mainLabel")} className="hidden flex-wrap items-center justify-center gap-1 md:flex">
          {links.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-4 py-[9px] text-[14px] transition-all duration-200 ${
                  active
                    ? "bg-white/12 font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                    : "font-medium text-foreground/70 hover:bg-white/9 hover:text-white hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                }`}
              >
                {t(item.label)}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <LanguageSwitcher />
          </div>
          {user ? (
            <div ref={profileRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((v) => !v)}
                className="btn-glass flex !min-h-11 items-center !gap-2.5 !py-1 !pl-1 !pr-3"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-[linear-gradient(145deg,var(--brand-light),var(--brand))] text-[12px] font-semibold text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]">
                  {initialsOf(user)}
                </span>
                <span className="hidden max-w-[140px] truncate text-[14px] font-medium sm:inline">{user.name || user.email}</span>
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                  className={`size-4 text-foreground/60 transition-transform ${profileOpen ? "rotate-180" : ""}`}
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
                  className="glass-panel animate-pop-in absolute right-0 top-[calc(100%+10px)] w-72 origin-top-right rounded-[28px] p-2"
                >
                  <div className="px-3 pb-3 pt-2">
                    <p className="truncate text-sm font-medium text-foreground">{user.name || user.email}</p>
                    {user.name && user.email && <p className="truncate text-xs text-muted">{user.email}</p>}
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
            <button type="button" data-mag="" onClick={openLogin} className="btn-primary !px-5 !py-3 !text-[14px]">
              {t("nav.logIn")}
            </button>
          )}

          <button
            type="button"
            aria-label={open ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid size-11 flex-none place-items-center rounded-full border border-white/14 bg-white/8 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] md:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d={open ? "M6 6l12 12M18 6L6 18" : "M4 8h16M4 16h16"} />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav
          aria-label={t("nav.mobileLabel")}
          className="glass-panel animate-pop-in absolute inset-x-3 top-[calc(100%+10px)] flex flex-col gap-0.5 rounded-[28px] p-2.5 md:hidden"
        >
          {links.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`rounded-[18px] px-[18px] py-3.5 text-[17px] font-medium transition-colors ${
                  active ? "bg-white/12 text-white" : "text-foreground/90 hover:bg-white/8"
                }`}
              >
                {t(item.label)}
              </Link>
            );
          })}
          <div className="mt-1.5 flex items-center justify-between gap-3 border-t border-white/10 pb-1.5 pl-[18px] pr-2.5 pt-3">
            <span className="text-[14px] text-foreground/60">{t("lang.label")}</span>
            <LanguageSwitcher />
          </div>
        </nav>
      )}
    </header>
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
