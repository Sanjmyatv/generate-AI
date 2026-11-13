"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { baseUrlFromHeaders } from "@/lib/actor";
import { prisma } from "@/lib/db";
import { assetIdFromUrl } from "@/lib/media";
import {
  GENJUTSU_LIGHT_LIST_USD_PER_SECOND,
  GENJUTSU_LIGHT_MAX_SECONDS,
  GENJUTSU_LIST_USD_PER_SECOND,
  HiggsfieldError,
  estimateImageEditUsd,
  estimateMotionTransferUsd,
} from "@/lib/higgsfield";
import { CREDIT_VALUE_MNT } from "@/config/pricing";
import { creditsForMargin, marginFor, perCreditMnt, usdMntRate } from "@/lib/pricing";
import { getPricingRates } from "@/lib/pricing-settings";
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

const COST_PAIRS = [
  { credits: "creditCost", cost: "costUsd", video: "480p", image: "1K" },
  { credits: "creditCostHd", cost: "costUsdHd", video: "720p HD", image: "" },
  { credits: "creditCost2k", cost: "costUsd2k", video: "", image: "2K" },
  { credits: "creditCost4k", cost: "costUsd4k", video: "", image: "4K" },
] as const;

/**
 * Refuses a price that sells below what it costs to run: the provider cost on record for that quality, plus
 * the retry buffer and the gateway fee, against the credits charged. Prices without a cost on record pass.
 */
async function lossMakingPrice(
  data: { type: "VIDEO" | "IMAGE" } & Record<string, unknown>,
  config: Record<string, unknown>,
): Promise<{ field: string; message: string } | null> {
  const rates = await getPricingRates();
  const usdMnt = usdMntRate();
  for (const pair of COST_PAIRS) {
    const credits = Number(data[pair.credits]);
    const costUsd = config[pair.cost];
    if (!Number.isFinite(credits) || typeof costUsd !== "number" || !(costUsd > 0)) continue;
    const m = marginFor({ costUsd, creditCost: credits, perCredit: CREDIT_VALUE_MNT, usdMnt, ...rates });
    if (m.marginMnt < 0) {
      const label = data.type === "VIDEO" ? pair.video : pair.image;
      const needed = creditsForMargin({ costUsd, perCredit: CREDIT_VALUE_MNT, usdMnt, targetPct: 0, ...rates });
      return {
        field: pair.credits,
        message: `At ${label} this price loses about ${Math.round(-m.marginMnt).toLocaleString("en-US")}₮ per generation. It needs at least ${Math.ceil(needed)} credits just to break even; use the automatic price for a 55% margin.`,
      };
    }
  }
  return null;
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

  const loss = await lossMakingPrice(data, generationConfig);
  if (loss) return { errors: { [loss.field]: loss.message }, message: "Fix the highlighted fields and save again." };

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

export type CostEstimateResult = { ok: true; usd: number; note?: string } | { ok: false; error: string };

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
  const seconds = light ? Math.ceil(Math.min(asset.duration, GENJUTSU_LIGHT_MAX_SECONDS)) * 2 : Math.ceil(asset.duration);
  const perSecond = (light ? GENJUTSU_LIGHT_LIST_USD_PER_SECOND : GENJUTSU_LIST_USD_PER_SECOND)[resolution];
  const why = cause instanceof HiggsfieldError ? cause.message : "lookup unavailable";
  return {
    ok: true,
    usd: Math.round(seconds * perSecond * 1000) / 1000,
    note: `Higgsfield's price lookup was unavailable (${why}), so this is the list price. Any discount on your account is not included, so the real cost may be lower.`,
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
        return { ok: true, usd };
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
      return { ok: true, usd };
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

/** The profit share the suggested price aims for. */
const TARGET_MARGIN_PCT = 55;

/** Rounds a credit price up to a whole credit (users see whole credits), and to 5 from 200 up. */
function niceCredits(credits: number) {
  const step = credits < 200 ? 1 : 5;
  return Math.ceil(credits / step - 1e-9) * step;
}

export interface PriceSuggestion {
  credits: number;
  creditsHd: number | null;
  costUsd: number;
  costUsdHd: number | null;
  targetPct: number;
  /** The pack the price was worked out against, and the margin each pack ends up with. */
  reference: string;
  margins: { name: string; pct: number }[];
  /** Set when the cost is an estimate rather than Higgsfield's own price. */
  note?: string;
  /** Image templates: a price and cost for each quality (credits and costUsd above are the 1K ones). */
  imageTiers?: { credits: Record<"1k" | "2k" | "4k", number>; costUsd: Record<"1k" | "2k" | "4k", number> };
}

export type PriceSuggestionResult = ({ ok: true } & PriceSuggestion) | { ok: false; error: string };

/**
 * Suggests credit prices that leave about 55% of what users pay after all costs: the provider's price,
 * the retry buffer on top of it and the payment gateway's share (both set in the pricing settings).
 * It looks up the real cost (Higgsfield for this account) and does the arithmetic here. The price is
 * worked out against the highlighted pack; if packs ever differ in price per credit, the others land a
 * little below or above the target.
 */
export async function suggestPriceAction(
  input: CostEstimateInput & {
    type: "VIDEO" | "IMAGE";
    /** For methods without a price lookup (Seedance): what one generation costs, typed by the admin. */
    manualCostUsd?: number;
    manualCostUsdHd?: number;
  },
): Promise<PriceSuggestionResult> {
  await requireAdmin();
  const packs = await prisma.creditPackage.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  if (packs.length === 0) return { ok: false, error: "There are no credit packs to price against." };
  const reference = packs.find((p) => p.highlighted) ?? packs[Math.floor(packs.length / 2)];
  const usdMnt = usdMntRate();
  const rates = await getPricingRates();
  const isVideo = input.type === "VIDEO";

  const creditsFor = (costUsd: number) =>
    niceCredits(creditsForMargin({ costUsd, perCredit: perCreditMnt(reference), usdMnt, targetPct: TARGET_MARGIN_PCT, ...rates }));

  // An image is priced at each of its three qualities (1K, 2K, 4K); the 1K price is the base one.
  if (!isVideo && hasPriceLookup(input.engine)) {
    const lookup = { ...input, prompt: input.prompt || "price lookup" };
    const costUsd = {} as Record<"1k" | "2k" | "4k", number>;
    let note: string | undefined;
    for (const tier of ["1k", "2k", "4k"] as const) {
      const priced = await estimateUsd({ ...lookup, imageResolution: tier });
      if (!priced.ok) return priced;
      costUsd[tier] = priced.usd;
      note ??= priced.note;
    }
    const credits = { "1k": creditsFor(costUsd["1k"]), "2k": creditsFor(costUsd["2k"]), "4k": creditsFor(costUsd["4k"]) };
    return {
      ok: true,
      credits: credits["1k"],
      creditsHd: null,
      costUsd: costUsd["1k"],
      costUsdHd: null,
      targetPct: TARGET_MARGIN_PCT,
      reference: reference.name,
      margins: packs.map((p) => ({
        name: p.name,
        pct: marginFor({ costUsd: costUsd["1k"], creditCost: credits["1k"], perCredit: perCreditMnt(p), usdMnt, ...rates }).marginPct,
      })),
      note,
      imageTiers: { credits, costUsd },
    };
  }

  // The provider's cost per generation: looked up where there is a price API, typed in otherwise.
  let standard: CostEstimateResult;
  let hd: CostEstimateResult | null = null;
  if (hasPriceLookup(input.engine)) {
    // An image's price does not depend on the words of its prompt, but the lookup insists on one.
    const lookup = { ...input, prompt: input.prompt || "price lookup" };
    standard = await estimateUsd({ ...lookup, videoResolution: "480p" });
    if (isVideo) hd = await estimateUsd({ ...lookup, videoResolution: "720p" });
  } else {
    if (!(input.manualCostUsd && input.manualCostUsd > 0)) {
      return { ok: false, error: "This method has no price lookup. Enter what one generation costs you and the credits are worked out for you." };
    }
    standard = { ok: true, usd: input.manualCostUsd };
    if (isVideo && input.manualCostUsdHd && input.manualCostUsdHd > 0) hd = { ok: true, usd: input.manualCostUsdHd };
  }
  if (!standard.ok) return standard;

  const credits = creditsFor(standard.usd);
  return {
    ok: true,
    credits,
    creditsHd: hd?.ok ? creditsFor(hd.usd) : null,
    costUsd: standard.usd,
    costUsdHd: hd?.ok ? hd.usd : null,
    targetPct: TARGET_MARGIN_PCT,
    reference: reference.name,
    note: standard.note,
    margins: packs.map((p) => ({
      name: p.name,
      pct: marginFor({ costUsd: standard.usd, creditCost: credits, perCredit: perCreditMnt(p), usdMnt, ...rates }).marginPct,
    })),
  };
}

/** Parses a percentage typed in the settings form ("5", "1.5") into a fraction, or null when it is not between 0 and `max` percent. */
function percentToRate(value: FormDataEntryValue | null, max: number) {
  const pct = Number(String(value ?? "").trim().replace(",", "."));
  if (!String(value ?? "").trim() || !Number.isFinite(pct) || pct < 0 || pct > max) return null;
  return Math.round(pct * 100) / 10000; // 1.5 -> 0.015, kept to 4 decimals
}

/** Saves the retry buffer and the payment gateway fee that the automatic selling price includes. */
export async function savePricingSettingsAction(form: FormData) {
  await requireAdmin();
  const retryBufferRate = percentToRate(form.get("retryPct"), 100);
  const gatewayFeeRate = percentToRate(form.get("feePct"), 20);
  if (retryBufferRate === null || gatewayFeeRate === null) redirect("/admin?notice=pricing_invalid");
  await prisma.pricingSetting.upsert({
    where: { id: "default" },
    update: { retryBufferRate, gatewayFeeRate },
    create: { id: "default", retryBufferRate, gatewayFeeRate },
  });
  redirect("/admin?notice=pricing_saved");
}
