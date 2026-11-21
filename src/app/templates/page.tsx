import type { Metadata } from "next";
import { TemplateBrowser } from "@/components/TemplateBrowser";
import { getT } from "@/lib/i18n/server";
import { getDiscoveryData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: `${t("all.title")} · zyro.ai` };
}

/** Every template of one kind (`?type=video`, the default, or `?type=image`), with filters: "Бүгдийг харах". */
export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const [{ type }, { categories, templates, trending }] = await Promise.all([searchParams, getDiscoveryData()]);
  const kind = type === "image" ? "image" : "video";
  return (
    <div className="w-full">
      <TemplateBrowser key={kind} type={kind} templates={templates} categories={categories} trending={trending} />
    </div>
  );
}
