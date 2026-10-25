"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { baseUrlFromHeaders } from "@/lib/actor";
import { prisma } from "@/lib/db";
import { assetIdFromUrl } from "@/lib/media";
import { buildTemplateData, readForm, slugify, type FieldErrors } from "@/lib/template-admin";

export interface TemplateFormState {
  errors: FieldErrors;
  message: string | null;
}

/** Asset ids a template points at: its preview and its source video. */
function assetIdsOf(previewUrl: string | null, config: unknown) {
  const ids = [assetIdFromUrl(previewUrl), assetIdFromUrl((config as { templateVideoUrl?: string } | null)?.templateVideoUrl)];
  return ids.filter((id): id is string => id !== null);
}

/** Deletes uploaded files that no template points at any more. */
async function deleteUnusedAssets(candidates: string[]) {
  if (candidates.length === 0) return;
  const templates = await prisma.template.findMany({ select: { previewUrl: true, generationConfig: true } });
  const inUse = new Set(templates.flatMap((t) => assetIdsOf(t.previewUrl, t.generationConfig)));
  const unused = candidates.filter((id) => !inUse.has(id));
  if (unused.length > 0) await prisma.asset.deleteMany({ where: { id: { in: unused } } });
}

/** Creates a template, or updates it when the form carries a `templateId`. */
export async function saveTemplateAction(_prev: TemplateFormState, form: FormData): Promise<TemplateFormState> {
  await requireAdmin();

  const templateId = String(form.get("templateId") ?? "");
  const existing = templateId ? await prisma.template.findUnique({ where: { id: templateId } }) : null;
  if (templateId && !existing) return { errors: {}, message: "This template no longer exists." };

  const built = buildTemplateData(readForm(form), baseUrlFromHeaders(await headers()), existing?.generationConfig);
  if (!built.ok) return { errors: built.errors, message: "Fix the highlighted fields and save again." };
  const { newCategory, generationConfig, ...data } = built.data;

  let categoryId = data.categoryId;
  if (newCategory) {
    categoryId = slugify(newCategory);
    const last = await prisma.category.aggregate({ _max: { sortOrder: true } });
    await prisma.category.upsert({
      where: { id: categoryId },
      update: {},
      create: { id: categoryId, name: newCategory, sortOrder: (last._max.sortOrder ?? 0) + 1 },
    });
  } else if (!(await prisma.category.findUnique({ where: { id: categoryId } }))) {
    return { errors: { categoryId: "That category doesn't exist." }, message: "Fix the highlighted fields and save again." };
  }

  const row = {
    ...data,
    categoryId,
    generationConfig: generationConfig as Prisma.InputJsonObject,
  };
  if (existing) {
    await prisma.template.update({ where: { id: existing.id }, data: row });
  } else {
    await prisma.template.create({ data: { ...row, id: `${slugify(data.name)}-${randomBytes(2).toString("hex")}` } });
  }

  // Files the template used to point at and no longer does.
  if (existing) await deleteUnusedAssets(assetIdsOf(existing.previewUrl, existing.generationConfig));
  redirect("/admin?notice=saved");
}

/** Shows or hides a template on the site without deleting it. */
export async function setTemplateActiveAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("templateId") ?? "");
  await prisma.template.updateMany({ where: { id }, data: { active: form.get("active") === "true" } });
  redirect("/admin");
}

/**
 * Deletes a template and its uploaded files. Refused once anyone has generated with it
 * (history keeps pointing at it): hide it instead.
 */
export async function deleteTemplateAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("templateId") ?? "");
  const template = await prisma.template.findUnique({ where: { id } });
  if (!template) redirect("/admin");

  if ((await prisma.generation.count({ where: { templateId: id } })) > 0) redirect("/admin?notice=has_generations");

  await prisma.template.delete({ where: { id } });
  await deleteUnusedAssets(assetIdsOf(template.previewUrl, template.generationConfig));
  redirect("/admin?notice=deleted");
}
