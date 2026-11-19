import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Geist_Mono, Geologica } from "next/font/google";
import { auth, emailLoginEnabled, enabledProviders } from "@/auth";
import { AuthConfigProvider } from "@/components/AuthConfig";
import { Footer } from "@/components/Footer";
import { I18nProvider } from "@/components/I18nProvider";
import { Nav } from "@/components/Nav";
import { SiteMotion } from "@/components/SiteMotion";
import { MESSAGES } from "@/lib/i18n/messages";
import { getT } from "@/lib/i18n/server";
import { getUserById } from "@/lib/users";
import "./globals.css";

// Geologica is the zyro.ai typeface; Cyrillic is included for Mongolian text.
const geologica = Geologica({
  variable: "--font-geologica",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** The public address, so link previews (Facebook, Messenger, X…) get absolute URLs for the share image. */
function siteUrl() {
  const fromEnv = process.env.APP_URL;
  try {
    if (fromEnv?.startsWith("http")) return new URL(fromEnv);
  } catch {
    /* fall through */
  }
  return new URL("https://www.zyro.one");
}

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  const title = t("meta.title");
  const description = t("meta.description");
  // The share image and the tab icon come from app/opengraph-image.png, twitter-image.png, icon.png and apple-icon.png.
  return {
    metadataBase: siteUrl(),
    title,
    description,
    openGraph: { type: "website", siteName: "zyro.ai", title, description, locale: locale === "mn" ? "mn_MN" : "en_US" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [session, { locale }] = await Promise.all([auth(), getT()]);
  const user = session?.user?.id ? await getUserById(session.user.id) : null;

  return (
    <html
      lang={locale}
      className={`${geologica.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="relative min-h-full flex flex-col">
        {/* Soft blue lights behind the page that drift and move with scroll (data-speed, see SiteMotion). */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div data-speed="-0.15" className="absolute left-[-320px] top-[-360px] size-[1000px] opacity-[0.34] max-md:size-[640px]">
            <div className="sky-blob" data-drift="" />
          </div>
          <div data-speed="-0.3" className="absolute right-[-300px] top-[40px] size-[900px] opacity-60 max-md:size-[560px]">
            <div className="sky-blob" data-drift="reverse" style={{ "--c": "var(--brand-dark)" } as CSSProperties} />
          </div>
          <div data-speed="-0.2" className="absolute left-[calc(25%-120px)] top-[1380px] size-[840px] opacity-20">
            <div className="sky-blob" />
          </div>
          <div data-speed="-0.12" className="absolute right-[calc(5%-120px)] top-[2380px] size-[860px] opacity-[0.13]">
            <div className="sky-blob" style={{ "--c": "var(--brand-light)" } as CSSProperties} />
          </div>
        </div>
        <SiteMotion />
        <I18nProvider locale={locale} messages={MESSAGES[locale]}>
          <AuthConfigProvider value={{ providers: enabledProviders, emailLogin: emailLoginEnabled }}>
            <Nav user={user ? { name: user.name, email: user.email, credits: Number(user.credits) } : null} />
            <main className="mx-auto w-full max-w-[1760px] flex-1 px-3 sm:px-4 md:px-6 lg:px-8">{children}</main>
            <Footer />
          </AuthConfigProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
