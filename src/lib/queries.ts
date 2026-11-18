import { prisma } from "@/lib/db";
import { supportedImageRatios } from "@/lib/higgsfield";
import { ratioSettings } from "@/lib/ratio";
import { getTrendingIds } from "@/lib/trending";
import type { Category, CreditPackage, Template } from "@/types";
import type {
  Category as DbCategory,
  CreditPackage as DbPackage,
  Template as DbTemplate,
} from "@/generated/prisma/client";

type DbTemplateWithCategories = DbTemplate & { categories: { categoryId: string }[] };

function toTemplate(t: DbTemplateWithCategories, trending: Set<string>): Template {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    nameMn: t.nameMn,
    descriptionMn: t.descriptionMn,
    previewUrl: t.previewUrl,
    posterUrl: t.previewPosterUrl,
    categoryIds: t.categories.map((c) => c.categoryId),
    type: t.type === "VIDEO" ? "video" : "image",
    creditCost: Number(t.creditCost),
    creditCostHd: t.creditCostHd === null ? null : Number(t.creditCostHd),
    creditCost2k: t.creditCost2k === null ? null : Number(t.creditCost2k),
    creditCost4k: t.creditCost4k === null ? null : Number(t.creditCost4k),
    durationSeconds: t.durationSeconds,
    aspectRatio: t.aspectRatio,
    requiredPhotoCount: t.requiredPhotoCount,
    photoLabels: t.photoLabels,
    photoRequirement: t.photoRequirement === "FULL_BODY" ? "full-body" : "face",
    active: t.active,
    trending: trending.has(t.id),
    heroFeatured: t.heroFeatured,
    createdAt: t.createdAt.toISOString(),
    ...imageRatioOptions(t),
  };
}

/** What an image template tells the browser about its ratio (nothing for a video). The allowed list comes from the integration. */
function imageRatioOptions(t: DbTemplate): Pick<Template, "ratioMode" | "ratios" | "userRatio" | "ratioFixed" | "ratioSource"> {
  if (t.type !== "IMAGE") return { ratioMode: null, ratios: [], userRatio: false, ratioFixed: null, ratioSource: 0 };
  const s = ratioSettings(t.generationConfig);
  return {
    ratioMode: s.mode,
    ratios: s.mode === "auto" ? supportedImageRatios() : [],
    userRatio: s.userRatio,
    ratioFixed: s.fixed,
    ratioSource: s.sourcePhoto,
  };
}

function toCategory(c: DbCategory): Category {
  return { id: c.id, name: c.name, order: c.sortOrder };
}

function toPackage(p: DbPackage): CreditPackage {
  return {
    id: p.id,
    name: p.name,
    credits: p.credits,
    priceMnt: p.priceMnt,
    bonusCredits: p.bonusCredits,
    highlighted: p.highlighted,
    nameMn: p.nameMn,
    priorityQueue: p.priorityQueue,
    topPriorityQueue: p.topPriorityQueue,
  };
}

async function activeTemplates() {
  return prisma.template.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    include: { categories: { select: { categoryId: true } } },
  });
}

/** Visible, non-system categories in the admin's order: what the chips and rows are made of. */
async function visibleCategories() {
  return prisma.category.findMany({ where: { active: true, system: false }, orderBy: { sortOrder: "asc" } });
}

/** The Trending category as the site shows it: its (renamed) label and templates, or null while there is none. */
async function getTrending() {
  const category = await prisma.category.findUnique({ where: { id: "trending" } });
  if (!category || !category.active) return null;
  const ids = await getTrendingIds();
  return ids.length > 0 ? { label: category.name, ids } : null;
}

export async function getHomeSections() {
  const [categories, templates, trending] = await Promise.all([visibleCategories(), activeTemplates(), getTrending()]);
  const trendingSet = new Set(trending?.ids ?? []);
  const all = templates.map((t) => toTemplate(t, trendingSet));
  const sections = categories.map((c) => ({
    category: toCategory(c),
    templates: all.filter((t) => t.categoryIds.includes(c.id)),
  }));
  if (trending) {
    const byId = new Map(all.map((t) => [t.id, t]));
    sections.unshift({
      category: { id: "trending", name: trending.label, order: -1 },
      templates: trending.ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
    });
  }
  return sections.filter((s) => s.templates.length > 0);
}

/** Everything the home page's discovery section needs; it filters by type and category itself. */
export async function getDiscoveryData() {
  const [categories, templates, trending] = await Promise.all([visibleCategories(), activeTemplates(), getTrending()]);
  const trendingSet = new Set(trending?.ids ?? []);
  return {
    categories: categories.map(toCategory),
    templates: templates.map((t) => toTemplate(t, trendingSet)),
    /** Null while too few templates qualify: the tab and the section stay hidden. */
    trending: trending ? { label: trending.label, ids: trending.ids } : null,
  };
}

export async function getTemplate(id: string) {
  const t = await prisma.template.findFirst({
    where: { id, active: true },
    include: { categories: { select: { categoryId: true } } },
  });
  return t ? toTemplate(t, new Set()) : null;
}

/**
 * Credits one 1K image costs on the site: the highest 1K price among the image templates on show, so a pack's
 * image count holds for every template. Null when no image template is on show.
 */
export async function getImageCredits1k(): Promise<number | null> {
  const { _max } = await prisma.template.aggregate({ where: { type: "IMAGE", active: true }, _max: { creditCost: true } });
  return _max.creditCost === null ? null : Number(_max.creditCost);
}

export async function getCreditPackages() {
  const packages = await prisma.creditPackage.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  return packages.map(toPackage);
}
