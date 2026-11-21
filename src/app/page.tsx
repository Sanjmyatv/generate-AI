import { Discovery } from "@/components/home/Discovery";
import { Hero } from "@/components/home/Hero";
import { HowItWorks, PricingTeaser } from "@/components/home/HowItWorks";
import { TrendingSpotlight } from "@/components/home/TrendingSpotlight";
import { getT } from "@/lib/i18n/server";
import { getDiscoveryData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ templates, trending }, { t }] = await Promise.all([getDiscoveryData(), getT()]);

  // The hero's big card: the template chosen in /admin ("Set as hero"). With none chosen (or it is hidden), the top
  // trending video, else any video with a preview, else any template.
  const withPreview = templates.filter((t) => t.previewUrl);
  const trendingIds = trending?.ids ?? [];
  const featured =
    templates.find((t) => t.heroFeatured) ??
    trendingIds.map((id) => withPreview.find((t) => t.id === id && t.type === "video")).find(Boolean) ??
    withPreview.find((t) => t.type === "video") ??
    withPreview[0];

  // The Trending section: the template chosen in /admin ("Set as Trending"), else the most-used one right now that has
  // a preview. With neither, the section is left out.
  const spotlight =
    templates.find((t) => t.trendingFeatured) ?? trendingIds.map((id) => withPreview.find((t) => t.id === id)).find(Boolean);

  return (
    <div className="w-full">
      <Hero featured={featured} />
      <HowItWorks />
      {spotlight && <TrendingSpotlight template={spotlight} label={trending?.label ?? t("disc.trendingChip")} />}
      {/* Videos and images, each one sliding row; "Бүгдийг харах" opens /templates. */}
      <Discovery templates={templates} />
      <PricingTeaser />
    </div>
  );
}
