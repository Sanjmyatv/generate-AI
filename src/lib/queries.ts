import { prisma } from "@/lib/db";
import type { Category, CreditPackage, Template } from "@/types";
import type {
  Category as DbCategory,
  CreditPackage as DbPackage,
  Template as DbTemplate,
} from "@/generated/prisma/client";

function toTemplate(t: DbTemplate): Template {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    previewUrl: t.previewUrl,
    categoryId: t.categoryId,
    type: t.type === "VIDEO" ? "video" : "image",
    creditCost: t.creditCost,
    aspectRatio: t.aspectRatio,
    requiredPhotoCount: t.requiredPhotoCount,
    photoRequirement: t.photoRequirement === "FULL_BODY" ? "full-body" : "face",
    active: t.active,
    trendingRank: t.trendingRank,
    createdAt: t.createdAt.toISOString(),
  };
}

function toCategory(c: DbCategory): Category {
  return { id: c.id, name: c.name, order: c.sortOrder };
}

function toPackage(p: DbPackage): CreditPackage {
  return { id: p.id, name: p.name, credits: p.credits, priceMnt: p.priceMnt };
}

export async function getHomeSections() {
  const [categories, templates] = await Promise.all([
    prisma.category.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.template.findMany({ where: { active: true }, orderBy: { createdAt: "desc" } }),
  ]);

  const trending = templates
    .filter((t) => t.trendingRank !== null)
    .sort((a, b) => (a.trendingRank ?? 0) - (b.trendingRank ?? 0));

  return categories
    .map((c) => ({
      category: toCategory(c),
      templates: (c.id === "trending"
        ? trending
        : templates.filter((t) => t.categoryId === c.id)
      ).map(toTemplate),
    }))
    .filter((s) => s.templates.length > 0);
}

export async function getTemplate(id: string) {
  const t = await prisma.template.findFirst({ where: { id, active: true } });
  return t ? toTemplate(t) : null;
}

export async function getCreditPackages() {
  const packages = await prisma.creditPackage.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  return packages.map(toPackage);
}
