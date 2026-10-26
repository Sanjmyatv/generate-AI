import type { Metadata } from "next";
import { Geist_Mono, Geologica } from "next/font/google";
import { auth } from "@/auth";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
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

  return (
    <html
      lang="en"
      className={`${geologica.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Nav signedIn={Boolean(session?.user?.id)} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 md:px-8 lg:px-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
