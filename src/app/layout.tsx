import type { Metadata } from "next";
import { Geist_Mono, Geologica } from "next/font/google";
import { auth, emailLoginEnabled, enabledProviders } from "@/auth";
import { AuthConfigProvider } from "@/components/AuthConfig";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
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

export const metadata: Metadata = {
  title: "zyro.ai — AI videos and images from your photos",
  description:
    "Choose a template, upload your photo, and let zyro.ai turn it into an AI video or image.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  const user = session?.user?.id ? await getUserById(session.user.id) : null;

  return (
    <html
      lang="en"
      className={`${geologica.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthConfigProvider value={{ providers: enabledProviders, emailLogin: emailLoginEnabled }}>
          <Nav user={user ? { name: user.name, email: user.email, credits: user.credits } : null} />
          <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 md:px-8 lg:px-16">{children}</main>
          <Footer />
        </AuthConfigProvider>
      </body>
    </html>
  );
}
