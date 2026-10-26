import { Discovery } from "@/components/home/Discovery";
import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { getDiscoveryData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ media?: string }> }) {
  const [{ media }, { categories, templates }] = await Promise.all([searchParams, getDiscoveryData()]);
  const initialMedia = media === "images" ? "image" : "video";

  return (
    <>
      <Hero />
      {/* Keyed so the nav's Videos/Images links switch the type even while already on this page. */}
      <Discovery key={initialMedia} templates={templates} categories={categories} initialMedia={initialMedia} />
      <HowItWorks />
    </>
  );
}
