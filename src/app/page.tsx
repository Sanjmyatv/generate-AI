import { Discovery, type DiscoveryTab } from "@/components/home/Discovery";
import { Hero } from "@/components/home/Hero";
import { HowItWorks, PricingTeaser } from "@/components/home/HowItWorks";
import { getDiscoveryData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ media?: string }> }) {
  const [{ media }, { categories, templates, trending }] = await Promise.all([searchParams, getDiscoveryData()]);
  const initialTab: DiscoveryTab = media === "images" ? "image" : media === "videos" ? "video" : "all";

  // The hero's big card shows a real template: the top trending video, else any video with a preview, else any template.
  const withPreview = templates.filter((t) => t.previewUrl);
  const trendingIds = trending?.ids ?? [];
  const featured =
    trendingIds.map((id) => withPreview.find((t) => t.id === id && t.type === "video")).find(Boolean) ??
    withPreview.find((t) => t.type === "video") ??
    withPreview[0];

  return (
    <div className="mx-auto w-full max-w-[1140px]">
      <Hero featured={featured} />
      <HowItWorks />
      {/* Keyed so the nav's Videos/Images links switch the filter even while already on this page. */}
      <Discovery key={initialTab} templates={templates} categories={categories} trending={trending} initialTab={initialTab} />
      <PricingTeaser />
    </div>
  );
}
