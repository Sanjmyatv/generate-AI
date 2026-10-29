"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/actions/auth";
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
  { href: "/", label: "Explore" },
  { href: "/?media=videos#discover", label: "Videos" },
  { href: "/?media=images#discover", label: "Images" },
  { href: "/pricing", label: "Pricing" },
  { href: "/history", label: "History" },
];

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
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-zinc-200 transition hover:bg-white/5";

export function Nav({ user }: { user: NavUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authRedirect, setAuthRedirect] = useState("/");
  const [profileOpen, setProfileOpen] = useState(false);
  const [packages, setPackages] = useState<CreditPackage[] | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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

  const opaque = scrolled || open;

  const header = (
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
              className={`${item.href === "/history" ? "hidden lg:inline " : ""}${
                isActive(pathname, item.href) ? "text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <div ref={profileRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((v) => !v)}
                className="btn-glass flex h-[42px] items-center gap-2.5 rounded-full py-1 pl-1 pr-3"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-linear-to-br from-purple-500 to-indigo-500 text-[12px] font-semibold text-white">
                  {initialsOf(user)}
                </span>
                <span className="hidden max-w-[140px] truncate text-[13px] sm:inline">{user.name || user.email}</span>
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
                  className="animate-pop-in absolute right-0 top-[calc(100%+10px)] w-72 origin-top-right rounded-2xl border border-zinc-800/80 bg-zinc-950/95 p-2 shadow-[0_0_40px_rgba(168,85,247,0.15)] backdrop-blur-xl"
                >
                  <div className="px-3 pb-3 pt-2">
                    <p className="truncate text-sm font-medium text-foreground">{user.name || user.email}</p>
                    {user.name && user.email && <p className="truncate text-xs text-zinc-400">{user.email}</p>}
                  </div>

                  <div className="mx-1 mb-2 flex items-center justify-between rounded-xl border border-purple-500/20 bg-purple-500/10 px-3 py-2.5">
                    <span className="text-sm text-foreground">⚡ {formatCredits(user.credits)} Credits</span>
                    <button
                      type="button"
                      onClick={() => void openTopUp()}
                      className="text-xs font-medium text-purple-300 underline-offset-2 hover:text-purple-200 hover:underline"
                    >
                      Top Up
                    </button>
                  </div>

                  <Link href="/profile" role="menuitem" onClick={() => setProfileOpen(false)} className={menuItemClass}>
                    <span aria-hidden="true">👤</span> My Profile
                  </Link>
                  <Link href="/history" role="menuitem" onClick={() => setProfileOpen(false)} className={menuItemClass}>
                    <span aria-hidden="true">🎬</span> Generation History
                  </Link>
                  <Link
                    href="/profile#settings"
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                    className={menuItemClass}
                  >
                    <span aria-hidden="true">⚙️</span> Account Settings
                  </Link>

                  <div className="mx-1 my-2 border-t border-zinc-800/80" />
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      role="menuitem"
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-400 transition hover:bg-red-500/10"
                    >
                      <span aria-hidden="true">↩</span> Log Out
                    </button>
                  </form>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={openLogin}
              className="btn-primary flex h-[42px] items-center justify-center rounded-full px-5 text-[13px] font-medium"
            >
              Log In
            </button>
          )}

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
          {links.map((item) => (
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

  return (
    <>
      {header}
      {/* Outside the header: its backdrop blur would otherwise make "fixed" mean "inside the header". */}
      {authOpen && <LoginModal redirectTo={authRedirect} onClose={() => setAuthOpen(false)} />}
      {packages && <QPayModal packages={packages} balance={user?.credits} onClose={() => setPackages(null)} />}
    </>
  );
}
