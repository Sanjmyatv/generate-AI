"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { slugify } from "@/lib/template-admin";
import { invalidateTrending } from "@/lib/trending";

const num = (value: FormDataEntryValue | null) => Number(String(value ?? "").trim().replace(",", "."));

/** A slug for a new category: from the typed slug or name when it has latin letters or digits, else a random one (Mongolian names have none). */
async function freeSlug(wanted: string) {
  const base = slugify(wanted);
  const prefix = base === "item" ? "cat" : base;
  let slug = base === "item" ? `cat-${randomBytes(2).toString("hex")}` : base;
  while (await prisma.category.findUnique({ where: { id: slug } })) slug = `${prefix}-${randomBytes(2).toString("hex")}`;
  return slug;
}

export async function createCategoryAction(form: FormData) {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 40) redirect("/admin/categories?notice=invalid_name");
  const slug = await freeSlug(String(form.get("slug") ?? "").trim() || name);
  const last = await prisma.category.aggregate({ _max: { sortOrder: true } });
  await prisma.category.create({ data: { id: slug, name, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  redirect("/admin/categories?notice=created");
}

export async function renameCategoryAction(form: FormData) {
  await requireAdmin();
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 40) redirect("/admin/categories?notice=invalid_name");
  await prisma.category.updateMany({ where: { id: String(form.get("id") ?? "") }, data: { name } });
  invalidateTrending();
  redirect("/admin/categories?notice=saved");
}

export async function setCategoryVisibleAction(form: FormData) {
  await requireAdmin();
  await prisma.category.updateMany({ where: { id: String(form.get("id") ?? "") }, data: { active: form.get("visible") === "true" } });
  redirect("/admin/categories");
}

/** Moves a category one place up or down among the ordinary ones (Trending always comes first, by itself). */
export async function moveCategoryAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const step = form.get("direction") === "up" ? -1 : 1;
  const all = await prisma.category.findMany({
    where: { system: false },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  const from = all.findIndex((c) => c.id === id);
  const to = from + step;
  if (from >= 0 && to >= 0 && to < all.length) {
    [all[from], all[to]] = [all[to], all[from]];
    await prisma.$transaction(all.map((c, i) => prisma.category.update({ where: { id: c.id }, data: { sortOrder: i + 1 } })));
  }
  redirect("/admin/categories");
}

/** Removes a category. Its templates are never deleted: they only lose this category. Trending cannot be removed. */
export async function deleteCategoryAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) redirect("/admin/categories");
  if (category.system) redirect("/admin/categories?notice=system");
  await prisma.category.delete({ where: { id } }); // the links in TemplateCategory cascade; the templates stay
  redirect("/admin/categories?notice=deleted");
}

/** The numbers behind the automatic Trending category. */
export async function saveTrendingSettingsAction(form: FormData) {
  await requireAdmin();
  const int = (name: string, min: number, max: number) => {
    const v = num(form.get(name));
    return Number.isInteger(v) && v >= min && v <= max ? v : null;
  };
  const windowDays = int("windowDays", 1, 90);
  const maxItems = int("maxItems", 1, 50);
  const minGenerations = int("minGenerations", 1, 1000);
  const minUsers = int("minUsers", 1, 1000);
  const minTemplates = int("minTemplates", 1, 50);
  if (windowDays === null || maxItems === null || minGenerations === null || minUsers === null || minTemplates === null) {
    redirect("/admin/categories?notice=invalid_trending");
  }
  const data = { enabled: form.get("enabled") === "on", windowDays, maxItems, minGenerations, minUsers, minTemplates };
  await prisma.trendingSetting.upsert({ where: { id: "default" }, update: data, create: { id: "default", ...data } });
  invalidateTrending();
  redirect("/admin/categories?notice=trending_saved");
}
