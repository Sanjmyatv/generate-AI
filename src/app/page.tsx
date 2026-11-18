import { Discovery } from "@/components/home/Discovery";
import { Hero } from "@/components/home/Hero";
import { HowItWorks, PricingTeaser } from "@/components/home/HowItWorks";
import { getDiscoveryData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { categories, templates, trending } = await getDiscoveryData();

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
      {/* Videos and images, each in its own section (the nav links to #videos and #images). */}
      <Discovery templates={templates} categories={categories} trending={trending} />
      <PricingTeaser />
    </div>
  );
}
