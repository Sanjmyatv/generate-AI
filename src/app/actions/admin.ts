"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { baseUrlFromHeaders } from "@/lib/actor";
import { prisma } from "@/lib/db";
import { assetIdFromUrl } from "@/lib/media";
import { estimateImageEditUsd, estimateMotionTransferUsd, HiggsfieldError } from "@/lib/higgsfield";
import {
  IMAGE_ASPECTS,
  IMAGE_QUALITIES,
  IMAGE_RESOLUTIONS,
  VIDEO_RESOLUTIONS,
  buildTemplateData,
  readForm,
  resolveUrl,
  slugify,
  type Engine,
  type FieldErrors,
} from "@/lib/template-admin";

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

export interface CostEstimateInput {
  engine: Engine;
  videoResolution: string;
  sourceVideoUrl: string;
  prompt: string;
  imageResolution: string;
  imageQuality: string;
  imageAspect: string;
}

export type CostEstimateResult = { ok: true; usd: number } | { ok: false; error: string };

const oneOf = <T extends string>(list: readonly T[], value: string): value is T => (list as readonly string[]).includes(value);

/**
 * Asks Higgsfield what one generation with these settings costs this account (discount
 * included), so the admin can price the template. Seedance has no estimate API.
 */
export async function estimateCostAction(input: CostEstimateInput): Promise<CostEstimateResult> {
  await requireAdmin();
  const baseUrl = baseUrlFromHeaders(await headers());
  // Estimates need the same fields as a real request; this stands in for the user's photo.
  const imageUrls = [`${baseUrl}/favicon.ico`];

  try {
    if (input.engine === "genjutsu") {
      const templateVideoUrl = resolveUrl(input.sourceVideoUrl, baseUrl);
      if (!templateVideoUrl) return { ok: false, error: "Upload the source video first." };
      if (!oneOf(VIDEO_RESOLUTIONS, input.videoResolution)) return { ok: false, error: "Choose a resolution first." };
      const usd = await estimateMotionTransferUsd({
        templateVideoUrl,
        imageUrls,
        prompt: input.prompt,
        resolution: input.videoResolution,
      });
      return { ok: true, usd };
    }
    if (input.engine === "marketing-image") {
      if (!input.prompt) return { ok: false, error: "Write the prompt first." };
      if (
        !oneOf(IMAGE_RESOLUTIONS, input.imageResolution) ||
        !oneOf(IMAGE_QUALITIES, input.imageQuality) ||
        !oneOf(IMAGE_ASPECTS, input.imageAspect)
      ) {
        return { ok: false, error: "Choose the quality settings first." };
      }
      const usd = await estimateImageEditUsd({
        imageUrls,
        prompt: input.prompt,
        resolution: input.imageResolution,
        quality: input.imageQuality,
        aspectRatio: input.imageAspect,
      });
      return { ok: true, usd };
    }
    return { ok: false, error: "Seedance has no price lookup: enter your cost from the BytePlus console." };
  } catch (e) {
    console.error("[admin] cost estimate failed", e);
    return {
      ok: false,
      error: e instanceof HiggsfieldError ? "Higgsfield could not price this request. Enter the cost by hand." : "Could not get the price.",
    };
  }
}
