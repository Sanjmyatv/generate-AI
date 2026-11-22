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

  // The Trending section: the templates added in /admin ("Add to Trending"), in the order they were added. With fewer
  // than three, the most-used templates with a preview fill it up to three. With none at all, it is left out.
  const chosen = templates
    .filter((t) => t.trendingFeaturedAt)
    .sort((a, b) => a.trendingFeaturedAt!.localeCompare(b.trendingFeaturedAt!));
  const fill = trendingIds
    .map((id) => withPreview.find((t) => t.id === id))
    .filter((t): t is (typeof templates)[number] => Boolean(t) && !chosen.includes(t!));
  const spotlight = [...chosen, ...fill.slice(0, Math.max(0, 3 - chosen.length))];

  return (
    <div className="w-full">
      <Hero featured={featured} />
      <HowItWorks />
      {spotlight.length > 0 && <TrendingSpotlight templates={spotlight} label={trending?.label ?? t("disc.trendingChip")} />}
      {/* Videos and images, each one sliding row; "Бүгдийг харах" opens /templates. */}
      <Discovery templates={templates} />
      <PricingTeaser />
    </div>
  );
}
