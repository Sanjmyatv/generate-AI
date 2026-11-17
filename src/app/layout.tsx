import type { Metadata } from "next";
import { Geist_Mono, Geologica } from "next/font/google";
import { auth, emailLoginEnabled, enabledProviders } from "@/auth";
import { AuthConfigProvider } from "@/components/AuthConfig";
import { Footer } from "@/components/Footer";
import { I18nProvider } from "@/components/I18nProvider";
import { Nav } from "@/components/Nav";
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

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("meta.title"), description: t("meta.description") };
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
        {/* Soft brand-coloured light behind the hero and between sections: blurred discs, never a gradient fill. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="ambient-glow left-[52%] top-[-3%] size-[640px] max-md:size-[360px]" />
          <div className="ambient-glow left-[-14%] top-[34%] size-[560px] opacity-[0.11] max-md:size-[340px]" />
          <div className="ambient-glow right-[-12%] top-[62%] size-[600px] opacity-[0.12] max-md:size-[340px]" />
          <div className="ambient-glow left-[10%] bottom-[2%] size-[520px] opacity-[0.1] max-md:size-[320px]" />
        </div>
        <I18nProvider locale={locale} messages={MESSAGES[locale]}>
          <AuthConfigProvider value={{ providers: enabledProviders, emailLogin: emailLoginEnabled }}>
            <Nav user={user ? { name: user.name, email: user.email, credits: Number(user.credits) } : null} />
            <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 md:px-8 lg:px-16">{children}</main>
            <Footer />
          </AuthConfigProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
