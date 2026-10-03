"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home" },
  { href: "/pricing", label: "Pricing" },
  { href: "/history", label: "History" },
  { href: "/profile", label: "Profile" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Nav() {
  const pathname = usePathname();

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-black/10 bg-background/90 backdrop-blur dark:border-white/10">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-bold tracking-tight">
            GenerateAI
          </Link>
          <nav className="hidden gap-6 text-sm md:flex">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive(pathname, item.href)
                    ? "font-semibold"
                    : "text-foreground/60 hover:text-foreground"
                }
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-black/10 bg-background text-xs md:hidden dark:border-white/10">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`py-3 text-center ${
              isActive(pathname, item.href) ? "font-semibold" : "text-foreground/60"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
