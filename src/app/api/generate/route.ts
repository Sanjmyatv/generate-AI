import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getActor, getBaseUrl } from "@/lib/actor";
import { DEFAULT_RESOLUTION, type Resolution } from "@/config/pricing";
import { chooseRatio, ratioSettings, snapRatio } from "@/lib/ratio";
import { failGeneration, refreshGeneration } from "@/lib/generations";
import { promptForSlots, validSlots } from "@/lib/partial-photos";
import { chooseSwapMode, withSwapMode } from "@/lib/swap-mode";
import { SeedanceError, parseSeedanceConfig, submitVideoEdit } from "@/lib/seedance";
import {
  parseGenjutsuConfig,
  parseMarketingImageConfig,
  submitImageEdit,
  supportedImageRatios,
  submitMotionTransfer,
} from "@/lib/higgsfield";

export const dynamic = "force-dynamic";

const MAX_ACTIVE_PER_ACTOR = 2;
const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

/** Thrown inside the charging transaction to abort it with an HTTP response. */
class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, readonly extra?: object) {
    super(code);
  }
}

/** Free generations before a guest must log in. Off by default: the free credits come with signup. */
function guestLimit() {
  const n = Number(process.env.GUEST_FREE_GENERATIONS ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * POST /api/generate  { templateId, uploadIds: string[], slots?: number[], resolution?: "480p" | "720p" | "1k" | "2k" | "4k", ratio?: "auto" | "3:4" | ..., swap?: "face" | "full-body" }
 *
 * `slots` says which of the template's people each photo is for (0-based, ascending). The user may fill in only some
 * of them; the others stay as in the original video. Without `slots` every person must have a photo.
 *
 * The client only chooses a template, its own photos and (for video) 480p or 720p. The
 * template video, the hidden prompt and the price come from the database, so callers cannot
 * run arbitrary prompts or pick their own price. The exact credits for the chosen
 * resolution are deducted here, before the provider is called, and refunded if the job fails.
 */
export async function POST(req: Request) {
  const actor = await getActor({ createGuest: true });

  let body: { templateId?: unknown; uploadIds?: unknown; slots?: unknown; resolution?: unknown; ratio?: unknown; swap?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const { templateId, uploadIds } = body;
  if (
    typeof templateId !== "string" ||
    !Array.isArray(uploadIds) ||
    uploadIds.length === 0 ||
    uploadIds.length > 5 ||
    !uploadIds.every((u): u is string => typeof u === "string")
  ) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const template = await prisma.template.findFirst({ where: { id: templateId, active: true } });
  const config = template ? parseSeedanceConfig(template.generationConfig) : null;
  const genjutsu = template && !config ? parseGenjutsuConfig(template.generationConfig) : null;
  const imageEdit =
    template && !config && !genjutsu ? parseMarketingImageConfig(template.generationConfig) : null;
  if (!template || (!config && !genjutsu && !imageEdit)) return Response.json({ error: "template_unavailable" }, { status: 400 });
  const slots = validSlots(body.slots, uploadIds.length, template.requiredPhotoCount);
  if (!slots) return Response.json({ error: "invalid_photo_count" }, { status: 400 });
  // People without a photo are left out of the prompt's replacements and kept as they are.
  // A template that lets the user choose gets "face swap only" or "full-body change" added to its prompt.
  const swapChoice = (template.generationConfig as { swapChoice?: unknown } | null)?.swapChoice === true;
  const swap = swapChoice
    ? chooseSwapMode(body.swap, template.photoRequirement === "FULL_BODY" ? "full-body" : "face")
    : null;
  const withSlots = <P extends string | undefined>(prompt: P) => {
    const slotted =
      prompt || slots.length < template.requiredPhotoCount
        ? promptForSlots(prompt ?? "", template.requiredPhotoCount, slots, template.photoLabels).trim()
        : prompt;
    return (swap ? withSwapMode(slotted, swap) : slotted) as P extends string ? string : string | undefined;
  };

  // Videos are priced per resolution: 480p by default, 720p only when the template has an HD price.
  let resolution: string;
  // Prices are exact decimals in the database; they stay Decimals until they reach the ledger.
  let cost: Prisma.Decimal = template.creditCost;
  let imageRenderSize: "1k" | "2k" | "4k" | undefined;
  if (template.type === "VIDEO") {
    const requested = body.resolution ?? DEFAULT_RESOLUTION;
    const offered: string[] = template.creditCostHd ? ["480p", "720p"] : ["480p"];
    if (typeof requested !== "string" || !offered.includes(requested)) {
      return Response.json({ error: "invalid_resolution" }, { status: 400 });
    }
    resolution = requested;
    if (requested === "720p") cost = template.creditCostHd!;
  } else {
    // An image has one price at the size set on the template, or, when the admin priced the 2K and 4K
    // qualities, a choice of 1K / 2K / 4K with a price each.
    const tiers = { "1k": template.creditCost, "2k": template.creditCost2k, "4k": template.creditCost4k };
    if (template.creditCost2k !== null || template.creditCost4k !== null) {
      const requested = body.resolution ?? "1k";
      const price = typeof requested === "string" && Object.hasOwn(tiers, requested) ? tiers[requested as keyof typeof tiers] : null;
      if (typeof requested !== "string" || price === null) {
        return Response.json({ error: "invalid_resolution" }, { status: 400 });
      }
      resolution = requested;
      cost = price;
      imageRenderSize = requested as "1k" | "2k" | "4k";
    } else {
      // One price: the 1K render at the template's quality tier, which is what that price was worked out for.
      resolution = "1k";
      imageRenderSize = "1k";
    }
  }
  const videoResolution = resolution as Resolution;

  // Photos must belong to this caller (or their guest session before login).
  const uploads = await prisma.upload.findMany({
    where: { id: { in: uploadIds }, ownerKey: { in: actor.keys } },
    select: { id: true, width: true, height: true },
  });
  if (new Set(uploadIds).size !== uploadIds.length || uploads.length !== uploadIds.length) {
    return Response.json({ error: "invalid_image" }, { status: 400 });
  }

  // An image's ratio never changes its price. The server decides it: from the source photo's real size in Auto,
  // or the template's fixed ratio, and refuses a ratio the template does not allow.
  let imageRatio = "auto";
  if (imageEdit) {
    const allowed = supportedImageRatios();
    const settings = ratioSettings(template.generationConfig);
    // The photo for the template's source person, or the first one given when that person was skipped.
    const sourceIndex = Math.max(slots.indexOf(Math.min(settings.sourcePhoto, template.requiredPhotoCount - 1)), 0);
    const source = uploads.find((u) => u.id === uploadIds[sourceIndex]);
    const detected = source?.width && source.height ? snapRatio(source.width, source.height, allowed) : null;
    const choice = chooseRatio(settings, body.ratio, detected, allowed);
    if (!choice.ok) return Response.json({ error: choice.error }, { status: 400 });
    imageRatio = choice.ratio;
  }

  const owner = actor.userId ? { userId: actor.userId } : { guestId: actor.guestId, userId: null };

  // Jobs only advance while someone polls /api/status, so one the user walked away from can
  // look "active" long after the provider finished. Settle those first so they don't block
  // a new generation (failed ones are refunded here too).
  const running = await prisma.generation.findMany({
    where: { status: { in: ["QUEUED", "PROCESSING"] }, ...owner },
    take: 10,
  });
  await Promise.all(running.map(refreshGeneration));

  const active = await prisma.generation.count({
    where: {
      status: { in: ["QUEUED", "PROCESSING"] },
      createdAt: { gt: new Date(Date.now() - ACTIVE_WINDOW_MS) },
      ...owner,
    },
  });
  if (active >= MAX_ACTIVE_PER_ACTOR) return Response.json({ error: "too_many_active" }, { status: 429 });

  let generation;
  try {
    generation = await prisma.$transaction(async (tx) => {
      if (actor.userId) {
        // Serialize this user's generations: parallel clicks queue here, so the limit below cannot be raced.
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actor.userId} FOR UPDATE`;
        const activeNow = await tx.generation.count({
          where: {
            status: { in: ["QUEUED", "PROCESSING"] },
            createdAt: { gt: new Date(Date.now() - ACTIVE_WINDOW_MS) },
            userId: actor.userId,
          },
        });
        if (activeNow >= MAX_ACTIVE_PER_ACTOR) throw new HttpError(429, "too_many_active");

        // Atomic check-and-deduct: the balance can never go negative.
        const charged = await tx.user.updateMany({
          where: { id: actor.userId, credits: { gte: cost } },
          data: { credits: { decrement: cost } },
        });
        if (charged.count === 0) {
          const user = await tx.user.findUnique({ where: { id: actor.userId }, select: { credits: true } });
          throw new HttpError(402, "insufficient_credits", { required: Number(cost), balance: Number(user?.credits ?? 0) });
        }
      } else {
        const used = await tx.generation.count({
          where: { guestId: actor.guestId, userId: null, status: { not: "FAILED" } },
        });
        if (used >= guestLimit()) throw new HttpError(401, "login_required");
      }

      const created = await tx.generation.create({
        data: {
          userId: actor.userId,
          guestId: actor.guestId,
          templateId: template.id,
          status: "QUEUED",
          inputKeys: uploadIds,
          creditCost: actor.userId ? cost : 0,
          resolution,
        },
      });
      if (actor.userId) {
        await tx.creditLedger.create({
          data: { userId: actor.userId, delta: cost.neg(), reason: "GENERATION", generationId: created.id },
        });
      }
      return created;
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return Response.json({ error: e.code, ...e.extra }, { status: e.status });
    }
    throw e;
  }

  const submitStart = Date.now();
  try {
    const base = getBaseUrl(req);
    const imageUrls = uploadIds.map((id) => `${base}/api/uploads/${id}`);
    const taskId = imageEdit
      ? await submitImageEdit({
          imageUrls,
          prompt: withSlots(imageEdit.prompt),
          quality: imageEdit.quality,
          resolution: imageRenderSize ?? imageEdit.resolution,
          aspectRatio: imageRatio,
        })
      : genjutsu
      ? await submitMotionTransfer({
          templateVideoUrl: genjutsu.templateVideoUrl,
          imageUrls,
          prompt: withSlots(genjutsu.prompt),
          resolution: videoResolution,
          light: genjutsu.light,
        })
      : await submitVideoEdit({
          // Undefined in reference mode: the video is generated from the photo(s) + prompt alone.
          templateVideoUrl: config!.mode === "reference" ? undefined : config!.templateVideoUrl,
          imageUrls,
          prompt: withSlots(config!.prompt),
          resolution: videoResolution,
          duration: config!.duration,
          ratio: config!.ratio,
          generateAudio: config!.generateAudio,
        });
    await prisma.generation.update({
      where: { id: generation.id },
      data: { providerTaskId: taskId, status: "PROCESSING" },
    });
    console.log(
      `[generate] ${generation.id} submitted in ${Date.now() - submitStart}ms (template ${template.id}, ${resolution}, ${uploadIds.length}/${template.requiredPhotoCount} photo(s))`,
    );
  } catch (e) {
    console.error("[generate] submit failed", e);
    const code = e instanceof SeedanceError ? e.code ?? "" : "";
    await failGeneration(generation.id, code || "provider_submit_failed"); // refunds credits

    // Tell the client *why* in terms it can show, without leaking provider details.
    if (code.startsWith("InputImage")) {
      return Response.json({ error: "invalid_image" }, { status: 422 }); // the user's photo was rejected
    }
    if (code.startsWith("InputVideo") || code === "ModelNotOpen") {
      return Response.json({ error: "template_unavailable" }, { status: 503 }); // our side, not the user's
    }
    return Response.json({ error: "generation_failed" }, { status: 502 });
  }

  return Response.json({ id: generation.id }, { status: 202 });
}
