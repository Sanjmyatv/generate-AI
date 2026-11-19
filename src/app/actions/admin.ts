"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { baseUrlFromHeaders } from "@/lib/actor";
import { prisma } from "@/lib/db";
import { assetIdsOf, deleteUnusedAssets } from "@/lib/assets";
import { assetIdFromUrl } from "@/lib/media";
import {
  GENJUTSU_LIGHT_LIST_USD_PER_SECOND,
  GENJUTSU_LIST_USD_PER_SECOND,
  HiggsfieldError,
  estimateImageEditUsd,
  supportedImageRatios,
  estimateMotionTransferUsd,
} from "@/lib/higgsfield";
import { GENJUTSU_LIGHT_MAX_SECONDS } from "@/config/pricing";
import { creditsForCostUsd, lossLines, targetMarginFor, videoCostUsd, type ImageQuality, type PricingConfig } from "@/lib/pricing";
import { getPricingConfig } from "@/lib/pricing-settings";
import { invalidateTrending } from "@/lib/trending";
import { changeData, planRepricing, type PriceChange } from "@/lib/repricing";
import {
  IMAGE_ASPECTS,
  IMAGE_QUALITIES,
  IMAGE_RESOLUTIONS,
  VIDEO_RESOLUTIONS,
  buildTemplateData,
  hasPriceLookup,
  readForm,
  resolveUrl,
  slugify,
  type Engine,
  type FieldErrors,
} from "@/lib/template-admin";

export interface TemplateFormState {
  errors: FieldErrors;
  message: string | null;
  /** Set when a price loses money: saving then needs one more click ("confirmLoss"). */
  lossWarning?: string[];
}

/** Creates a template, or updates it when the form carries a `templateId`. */
export async function saveTemplateAction(_prev: TemplateFormState, form: FormData): Promise<TemplateFormState> {
  await requireAdmin();

  const templateId = String(form.get("templateId") ?? "");
  const existing = templateId ? await prisma.template.findUnique({ where: { id: templateId } }) : null;
  if (templateId && !existing) return { errors: {}, message: "This template no longer exists." };

  const built = buildTemplateData(
    readForm(form),
    baseUrlFromHeaders(await headers()),
    existing?.generationConfig,
    supportedImageRatios(),
  );
  if (!built.ok) return { errors: built.errors, message: "Fix the highlighted fields and save again." };
  const { categoryIds, generationConfig, ...data } = built.data;

  // A price below cost needs one more, deliberate click; below the target margin only the editor's red warning shows.
  const losses = lossLines(data, generationConfig, await getPricingConfig());
  if (losses.length > 0 && form.get("confirmLoss") !== "yes") return { errors: {}, message: null, lossWarning: losses };

  // Only real, non-system categories can be picked (Trending fills itself).
  const valid = new Set(
    (await prisma.category.findMany({ where: { id: { in: categoryIds }, system: false }, select: { id: true } })).map((c) => c.id),
  );
  const picked = categoryIds.filter((id) => valid.has(id));

  const row = { ...data, generationConfig: generationConfig as Prisma.InputJsonObject };
  const links = { deleteMany: {}, create: picked.map((categoryId) => ({ categoryId })) };
  if (existing) {
    await prisma.template.update({ where: { id: existing.id }, data: { ...row, categories: links } });
  } else {
    await prisma.template.create({
      data: { ...row, id: `${slugify(data.name)}-${randomBytes(2).toString("hex")}`, categories: { create: links.create } },
    });
  }
  invalidateTrending();

  // Files the template used to point at and no longer does.
  if (existing) await deleteUnusedAssets(assetIdsOf(existing.previewUrl, existing.generationConfig, existing.previewPosterUrl));
  redirect("/admin?notice=saved");
}

/**
 * Makes a template the home page's hero (the big card at the top), or removes it. Only one template is the hero:
 * choosing one clears the others. With none chosen the home page picks one automatically.
 */
export async function setHeroTemplateAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("templateId") ?? "");
  const on = form.get("hero") === "true";
  await prisma.$transaction([
    prisma.template.updateMany({ where: { heroFeatured: true }, data: { heroFeatured: false } }),
    ...(on ? [prisma.template.updateMany({ where: { id }, data: { heroFeatured: true } })] : []),
  ]);
  redirect(on ? "/admin?notice=hero_set" : "/admin?notice=hero_cleared");
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
  await deleteUnusedAssets(assetIdsOf(template.previewUrl, template.generationConfig, template.previewPosterUrl));
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

/** Where a provider cost came from: "account" is Higgsfield's own price for this account, "list" its published price. */
export type CostOrigin = "account" | "list";

export type CostEstimateResult = { ok: true; usd: number; origin: CostOrigin; note?: string } | { ok: false; error: string };

const oneOf = <T extends string>(list: readonly T[], value: string): value is T => (list as readonly string[]).includes(value);

/**
 * Asks Higgsfield what one generation with these settings costs this account (discount
 * included), so the admin can price the template. Seedance has no estimate API.
 */
export async function estimateCostAction(input: CostEstimateInput): Promise<CostEstimateResult> {
  await requireAdmin();
  return estimateUsd(input);
}

/**
 * Genjutsu's cost worked out from its published per-second price and the source video's length.
 * No discount is assumed, so if your account is discounted the real cost is lower than this.
 */
async function listPriceEstimate(input: CostEstimateInput, light: boolean, cause: unknown): Promise<CostEstimateResult | null> {
  const assetId = assetIdFromUrl(input.sourceVideoUrl);
  const asset = assetId ? await prisma.asset.findUnique({ where: { id: assetId }, select: { duration: true } }) : null;
  if (!asset?.duration) return null;
  const resolution = input.videoResolution as keyof typeof GENJUTSU_LIST_USD_PER_SECOND;
  // Light is billed per second of output, which is the source video trimmed to its first 30 seconds.
  const seconds = light ? Math.ceil(Math.min(asset.duration, GENJUTSU_LIGHT_MAX_SECONDS)) : Math.ceil(asset.duration);
  const perSecond = (light ? GENJUTSU_LIGHT_LIST_USD_PER_SECOND : GENJUTSU_LIST_USD_PER_SECOND)[resolution];
  const why = cause instanceof HiggsfieldError ? cause.message : "lookup unavailable";
  return {
    ok: true,
    origin: "list",
    usd: Math.round(seconds * perSecond * 1000) / 1000,
    note: `List price: Higgsfield's price lookup was unavailable (${why}). Any discount on your account is not included, so the real cost may be lower.`,
  };
}

async function estimateUsd(input: CostEstimateInput): Promise<CostEstimateResult> {
  const baseUrl = baseUrlFromHeaders(await headers());
  // Estimates need the same fields as a real request; this stands in for the user's photo.
  const imageUrls = [`${baseUrl}/brand/z-emblem.png`];

  try {
    if (input.engine === "genjutsu" || input.engine === "genjutsu-light") {
      const templateVideoUrl = resolveUrl(input.sourceVideoUrl, baseUrl);
      if (!templateVideoUrl) return { ok: false, error: "Upload the source video first." };
      if (!oneOf(VIDEO_RESOLUTIONS, input.videoResolution)) return { ok: false, error: "Choose a resolution first." };
      const light = input.engine === "genjutsu-light";
      try {
        const usd = await estimateMotionTransferUsd({
          templateVideoUrl,
          imageUrls,
          prompt: input.prompt,
          resolution: input.videoResolution,
          light,
        });
        return { ok: true, usd, origin: "account" };
      } catch (e) {
        // The price lookup is a convenience: without it, work from the published list price.
        console.error("[admin] Higgsfield price lookup failed, using the list price", e);
        const fallback = await listPriceEstimate(input, light, e);
        if (fallback) return fallback;
        throw e;
      }
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
      return { ok: true, usd, origin: "account" };
    }
    return { ok: false, error: "Seedance has no price lookup: enter your cost from the BytePlus console." };
  } catch (e) {
    console.error("[admin] cost estimate failed", e);
    return {
      ok: false,
      error:
        e instanceof HiggsfieldError
          ? `Higgsfield could not price this request (${e.message}${e.detail ? `: ${e.detail}` : ""}). Turn off the automatic price to enter it by hand.`
          : "Could not get the price.",
    };
  }
}

/** Where a suggested price came from, so the editor never says two different things at once. */
export type PriceOrigin = "manual" | CostOrigin;

export interface PriceSuggestion {
  credits: number;
  creditsHd: number | null;
  costUsd: number;
  costUsdHd: number | null;
  targetPct: number;
  /** "manual": the per-second rate in the pricing settings (or a cost typed by hand); otherwise Higgsfield's own price or list price. */
  origin: PriceOrigin;
  /** Says how the cost was found (rate used, or why the list price was used). */
  note?: string;
  /** Image templates: a price per quality. 2K and 4K are null unless a verified provider cost exists for them. */
  imageTiers?: { credits: Record<"1k" | "2k" | "4k", number | null>; costUsd: Partial<Record<"1k" | "2k" | "4k", number>> };
}

export type PriceSuggestionResult = ({ ok: true } & PriceSuggestion) | { ok: false; error: string };

/** The length a video is priced for: what the form says, else the uploaded source video's, capped for Genjutsu Light. */
async function pricedSeconds(input: { engine: Engine; durationSeconds?: number | null; sourceVideoUrl: string }) {
  let seconds = input.durationSeconds && input.durationSeconds > 0 ? input.durationSeconds : null;
  if (seconds === null) {
    const assetId = assetIdFromUrl(input.sourceVideoUrl);
    const asset = assetId ? await prisma.asset.findUnique({ where: { id: assetId }, select: { duration: true } }) : null;
    if (asset?.duration) seconds = Math.ceil(asset.duration);
  }
  if (seconds === null) return null;
  return input.engine === "genjutsu-light" ? Math.min(seconds, GENJUTSU_LIGHT_MAX_SECONDS) : seconds;
}

/**
 * Suggests the credits for a template from the pricing settings: ceil(provider cost × rate × K ÷ credit value),
 * rounded up once on the whole video. The provider cost is the per-second rate in the settings by default
 * (a cost typed by hand wins, for Seedance); with the "Higgsfield" price source it is looked up per template and
 * labelled as the account price or the list price. Images use the same formula with the image margin: the 1K price
 * comes from the looked-up or typed cost (the expected $0.075 at the Low tier when neither exists), and 2K / 4K are
 * only priced when a verified cost exists for them.
 */
export async function suggestPriceAction(
  input: CostEstimateInput & {
    type: "VIDEO" | "IMAGE";
    /** The template's length in seconds, when the form knows it. */
    durationSeconds?: number | null;
    /** For methods without a price lookup (Seedance): what one generation costs you, typed by the admin. */
    manualCostUsd?: number;
    manualCostUsdHd?: number;
  },
): Promise<PriceSuggestionResult> {
  await requireAdmin();
  const cfg = await getPricingConfig();

  if (input.type === "IMAGE") {
    const costUsd: Partial<Record<"1k" | "2k" | "4k", number>> = {};
    let note: string | undefined;
    let origin: PriceOrigin = "manual";
    if (hasPriceLookup(input.engine)) {
      const lookup = { ...input, prompt: input.prompt || "price lookup" };
      for (const tier of ["1k", "2k", "4k"] as const) {
        const priced = await estimateUsd({ ...lookup, imageResolution: tier });
        if (!priced.ok) continue;
        costUsd[tier] = priced.usd;
        if (priced.origin === "list") {
          origin = "list";
          note ??= priced.note;
        } else if (origin !== "list") origin = "account";
      }
    }
    if (costUsd["1k"] === undefined) {
      if (input.manualCostUsd && input.manualCostUsd > 0) {
        costUsd["1k"] = input.manualCostUsd;
        note ??= "Provider cost typed by hand.";
      } else if (input.imageQuality === "low") {
        costUsd["1k"] = cfg.imageCostUsd1kLow;
        note ??= `Expected cost of a 1K Low image: $${cfg.imageCostUsd1kLow.toFixed(3)} (pricing settings).`;
      }
    }
    const cost1k = costUsd["1k"];
    if (cost1k === undefined) {
      return { ok: false, error: "Higgsfield could not be asked for this quality's cost. Type the provider cost at 1K." };
    }
    // The published 1K Low price is the reference: a real cost far from it needs a human look before it sets a price.
    if (input.imageQuality === "low" && Math.abs(cost1k / cfg.imageCostUsd1kLow - 1) > 0.1) {
      note = `${note ? note + " " : ""}Warning: this cost is more than 10% away from the expected $${cfg.imageCostUsd1kLow.toFixed(3)} for a 1K Low image. Check it before saving.`;
    }
    const tier = (key: "2k" | "4k") => (costUsd[key] === undefined ? null : creditsForCostUsd(costUsd[key], cfg, "image"));
    const credits = { "1k": creditsForCostUsd(cost1k, cfg, "image"), "2k": tier("2k"), "4k": tier("4k") };
    return {
      ok: true,
      credits: credits["1k"],
      creditsHd: null,
      costUsd: cost1k,
      costUsdHd: null,
      targetPct: targetMarginFor(cfg, "image"),
      origin,
      note,
      imageTiers: { credits, costUsd },
    };
  }

  const seconds = await pricedSeconds(input);
  if (seconds === null) return { ok: false, error: "Upload the source video or enter its length first." };

  let cost480: number;
  let cost720: number | null;
  let origin: PriceOrigin = "manual";
  let note: string;
  if (cfg.priceSource === "HIGGSFIELD" && hasPriceLookup(input.engine)) {
    const lookup = { ...input, prompt: input.prompt || "price lookup" };
    const [standard, hd] = [await estimateUsd({ ...lookup, videoResolution: "480p" }), await estimateUsd({ ...lookup, videoResolution: "720p" })];
    if (!standard.ok) return standard;
    if (!hd.ok) return hd;
    cost480 = standard.usd;
    cost720 = hd.usd;
    origin = standard.origin === "list" || hd.origin === "list" ? "list" : "account";
    note = origin === "list" ? (standard.origin === "list" ? standard : hd).note! : "Account price from Higgsfield.";
  } else if (input.manualCostUsd && input.manualCostUsd > 0) {
    cost480 = input.manualCostUsd;
    cost720 = input.manualCostUsdHd && input.manualCostUsdHd > 0 ? input.manualCostUsdHd : null;
    note = "Provider cost typed by hand.";
  } else {
    cost480 = videoCostUsd(seconds, "480p", cfg);
    cost720 = videoCostUsd(seconds, "720p", cfg);
    note = `Manual rate: $${cfg.videoUsdPerSecond}/s × ${seconds} s (720p ×${cfg.hdMultiplier}).`;
  }

  return {
    ok: true,
    credits: creditsForCostUsd(cost480, cfg),
    creditsHd: cost720 === null ? null : creditsForCostUsd(cost720, cfg),
    costUsd: Math.round(cost480 * 10000) / 10000,
    costUsdHd: cost720 === null ? null : Math.round(cost720 * 10000) / 10000,
    targetPct: cfg.targetMarginPct,
    origin,
    note,
  };
}

export interface PricingSettingsState {
  errors: Record<string, string>;
  message: string | null;
  /** Set when the change would reprice automatic templates: shown for confirmation before anything is applied. */
  changes: PriceChange[] | null;
}

const num = (value: FormDataEntryValue | null) => Number(String(value ?? "").trim().replace(",", "."));

/**
 * Saves the pricing settings. When they would change the credits of templates priced automatically, nothing is
 * saved yet: the old → new list comes back for confirmation, and only the confirming submit saves the settings
 * and reprices those templates. Templates priced by hand are never touched.
 */
export async function savePricingSettingsAction(_prev: PricingSettingsState, form: FormData): Promise<PricingSettingsState> {
  await requireAdmin();
  const errors: Record<string, string> = {};
  const field = (name: string, label: string, min: number, max: number, integer = false) => {
    const value = num(form.get(name));
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      errors[name] = `${label}: enter ${integer ? "a whole number" : "a number"} from ${min} to ${max}.`;
    }
    return value;
  };
  const creditValueMnt = field("creditValueMnt", "Credit value", 1, 100000, true);
  const targetMarginPct = field("targetMarginPct", "Target margin, video", 0, 90);
  const targetMarginImagesPct = field("targetMarginImagesPct", "Target margin, images", 0, 90);
  const retryPct = field("retryPct", "Retry buffer", 0, 100);
  const feePct = field("feePct", "Payment gateway fee", 0, 20);
  const usdMnt = field("usdMnt", "USD → MNT rate", 1, 100000);
  const videoUsdPerSecond = field("videoUsdPerSecond", "Video cost per second", 0.0001, 10);
  const hdMultiplier = field("hdMultiplier", "720p multiplier", 1, 10);
  const referenceSeconds = field("referenceSeconds", "Reference video length", 1, 120, true);
  const listUsdPerSecond = field("listUsdPerSecond", "List price per second", 0.0001, 10);
  const imageCostUsd1kLow = field("imageCostUsd1kLow", "Image cost, 1K Low", 0.0001, 10);
  const imageQuality: ImageQuality = form.get("imageQuality") === "high" ? "high" : form.get("imageQuality") === "medium" ? "medium" : "low";
  const priceSource = form.get("priceSource") === "HIGGSFIELD" ? "HIGGSFIELD" : "MANUAL";
  for (const [name, margin] of [["targetMarginPct", targetMarginPct], ["targetMarginImagesPct", targetMarginImagesPct]] as const) {
    if (!errors[name] && !errors.feePct && margin + feePct >= 95) errors[name] = "Target margin plus the gateway fee must stay under 95%.";
  }
  if (Object.keys(errors).length > 0) return { errors, message: "Fix the highlighted fields.", changes: null };

  const row = {
    creditValueMnt,
    targetMarginPct,
    targetMarginImagesPct,
    imageQuality,
    imageCostUsd1kLow,
    retryBufferRate: Math.round(retryPct * 100) / 10000,
    gatewayFeeRate: Math.round(feePct * 100) / 10000,
    usdMntRate: usdMnt,
    videoUsdPerSecond,
    hdMultiplier,
    referenceSeconds,
    priceSource,
    listUsdPerSecond,
  } as const;
  const next: PricingConfig = {
    creditValueMnt,
    targetMarginPct,
    targetMarginImagesPct,
    imageQuality,
    imageCostUsd1kLow,
    retryRate: row.retryBufferRate,
    gatewayFeeRate: row.gatewayFeeRate,
    usdMnt,
    videoUsdPerSecond,
    hdMultiplier,
    referenceSeconds,
    priceSource,
    listUsdPerSecond,
  };

  const templates = await prisma.template.findMany({ where: { autoCredits: true } });
  const { auto } = planRepricing(
    templates.map((t) => ({
      ...t,
      creditCost: Number(t.creditCost),
      creditCostHd: t.creditCostHd === null ? null : Number(t.creditCostHd),
      creditCost2k: t.creditCost2k === null ? null : Number(t.creditCost2k),
      creditCost4k: t.creditCost4k === null ? null : Number(t.creditCost4k),
    })),
    next,
  );

  if (auto.length > 0 && form.get("intent") !== "confirm") {
    return { errors: {}, message: null, changes: auto };
  }

  await prisma.$transaction(async (tx) => {
    await tx.pricingSetting.upsert({ where: { id: "default" }, update: row, create: { id: "default", ...row } });
    // Only the templates the admin confirmed, priced automatically: their credits follow the new settings.
    for (const c of auto) {
      await tx.template.update({ where: { id: c.id }, data: changeData(c) });
    }
  });
  redirect(`/admin?notice=${auto.length > 0 ? "pricing_applied" : "pricing_saved"}`);
}

/** Edits a credit pack. The credits follow the price (price ÷ credit value), so they cannot drift apart. */
export async function savePackAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("packId") ?? "");
  const cfg = await getPricingConfig();
  const priceMnt = num(form.get("priceMnt"));
  const name = String(form.get("name") ?? "").trim();
  const nameMn = String(form.get("nameMn") ?? "").trim();
  if (!(await prisma.creditPackage.findUnique({ where: { id } }))) redirect("/admin/packs?notice=missing");
  if (!name || name.length > 60 || nameMn.length > 60) redirect("/admin/packs?notice=invalid");
  if (!Number.isInteger(priceMnt) || priceMnt < cfg.creditValueMnt || priceMnt % cfg.creditValueMnt !== 0) {
    redirect("/admin/packs?notice=invalid_price");
  }
  const highlighted = form.get("highlighted") === "on";
  await prisma.$transaction(async (tx) => {
    if (highlighted) await tx.creditPackage.updateMany({ where: { id: { not: id } }, data: { highlighted: false } });
    await tx.creditPackage.update({
      where: { id },
      data: {
        name,
        nameMn: nameMn || null,
        priceMnt,
        credits: priceMnt / cfg.creditValueMnt,
        bonusCredits: 0,
        highlighted,
        active: form.get("active") === "on",
        priorityQueue: form.get("priorityQueue") === "on",
        topPriorityQueue: form.get("topPriorityQueue") === "on",
      },
    });
  });
  redirect("/admin/packs?notice=saved");
}
