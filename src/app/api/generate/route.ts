import { prisma } from "@/lib/db";
import { getActor, getBaseUrl } from "@/lib/actor";
import { DEFAULT_RESOLUTION, type Resolution } from "@/config/pricing";
import { failGeneration, refreshGeneration } from "@/lib/generations";
import { SeedanceError, parseSeedanceConfig, submitVideoEdit } from "@/lib/seedance";
import {
  parseGenjutsuConfig,
  parseMarketingImageConfig,
  submitImageEdit,
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
 * POST /api/generate  { templateId, uploadIds: string[], resolution?: "480p" | "720p" }
 *
 * The client only chooses a template, its own photos and (for video) 480p or 720p. The
 * template video, the hidden prompt and the price come from the database, so callers cannot
 * run arbitrary prompts or pick their own price. The exact credits for the chosen
 * resolution are deducted here, before the provider is called, and refunded if the job fails.
 */
export async function POST(req: Request) {
  const actor = await getActor({ createGuest: true });

  let body: { templateId?: unknown; uploadIds?: unknown; resolution?: unknown };
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
  if (uploadIds.length !== template.requiredPhotoCount) {
    return Response.json({ error: "invalid_photo_count" }, { status: 400 });
  }

  // Videos are priced per resolution: 480p by default, 720p only when the template has an HD price.
  let resolution: string;
  let cost = template.creditCost;
  if (template.type === "VIDEO") {
    const requested = body.resolution ?? DEFAULT_RESOLUTION;
    const offered: string[] = template.creditCostHd ? ["480p", "720p"] : ["480p"];
    if (typeof requested !== "string" || !offered.includes(requested)) {
      return Response.json({ error: "invalid_resolution" }, { status: 400 });
    }
    resolution = requested;
    if (requested === "720p") cost = template.creditCostHd!;
  } else {
    resolution = imageEdit?.resolution ?? "image"; // images have one price and a fixed render size
  }
  const videoResolution = resolution as Resolution;

  // Photos must belong to this caller (or their guest session before login).
  const uploads = await prisma.upload.findMany({
    where: { id: { in: uploadIds }, ownerKey: { in: actor.keys } },
    select: { id: true },
  });
  if (new Set(uploadIds).size !== uploadIds.length || uploads.length !== uploadIds.length) {
    return Response.json({ error: "invalid_image" }, { status: 400 });
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
        // Atomic check-and-deduct: the balance can never go negative.
        const charged = await tx.user.updateMany({
          where: { id: actor.userId, credits: { gte: cost } },
          data: { credits: { decrement: cost } },
        });
        if (charged.count === 0) {
          const user = await tx.user.findUnique({ where: { id: actor.userId }, select: { credits: true } });
          throw new HttpError(402, "insufficient_credits", { required: cost, balance: user?.credits ?? 0 });
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
          data: { userId: actor.userId, delta: -cost, reason: "GENERATION", generationId: created.id },
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

  try {
    const base = getBaseUrl(req);
    const imageUrls = uploadIds.map((id) => `${base}/api/uploads/${id}`);
    const taskId = imageEdit
      ? await submitImageEdit({
          imageUrls,
          prompt: imageEdit.prompt,
          quality: imageEdit.quality,
          resolution: imageEdit.resolution,
          aspectRatio: imageEdit.aspectRatio,
        })
      : genjutsu
      ? await submitMotionTransfer({
          templateVideoUrl: genjutsu.templateVideoUrl,
          imageUrls,
          prompt: genjutsu.prompt,
          resolution: videoResolution,
        })
      : await submitVideoEdit({
          // Undefined in reference mode: the video is generated from the photo(s) + prompt alone.
          templateVideoUrl: config!.mode === "reference" ? undefined : config!.templateVideoUrl,
          imageUrls,
          prompt: config!.prompt,
          resolution: videoResolution,
          duration: config!.duration,
          ratio: config!.ratio,
          generateAudio: config!.generateAudio,
        });
    await prisma.generation.update({
      where: { id: generation.id },
      data: { providerTaskId: taskId, status: "PROCESSING" },
    });
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
