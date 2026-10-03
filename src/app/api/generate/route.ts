import { prisma } from "@/lib/db";
import { getActor, getBaseUrl } from "@/lib/actor";
import { failGeneration } from "@/lib/generations";
import { parseSeedanceConfig, submitVideoEdit } from "@/lib/seedance";

export const dynamic = "force-dynamic";

const MAX_ACTIVE_PER_ACTOR = 2;
const ACTIVE_WINDOW_MS = 30 * 60 * 1000;

/** Thrown inside the charging transaction to abort it with an HTTP response. */
class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, readonly extra?: object) {
    super(code);
  }
}

function guestLimit() {
  const n = Number(process.env.GUEST_FREE_GENERATIONS ?? 1);
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

/**
 * POST /api/generate  { templateId, uploadIds: string[] }
 *
 * The client only chooses a template and its own photos. The template video and the
 * hidden prompt come from the database, so callers cannot run arbitrary prompts
 * against the paid API. Credits are reserved here and refunded if the job fails.
 */
export async function POST(req: Request) {
  const actor = await getActor({ createGuest: true });

  let body: { templateId?: unknown; uploadIds?: unknown };
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
  if (!template || !config) return Response.json({ error: "template_unavailable" }, { status: 400 });
  if (uploadIds.length !== template.requiredPhotoCount) {
    return Response.json({ error: "invalid_photo_count" }, { status: 400 });
  }

  // Photos must belong to this caller (or their guest session before login).
  const uploads = await prisma.upload.findMany({
    where: { id: { in: uploadIds }, ownerKey: { in: actor.keys } },
    select: { id: true },
  });
  if (new Set(uploadIds).size !== uploadIds.length || uploads.length !== uploadIds.length) {
    return Response.json({ error: "invalid_image" }, { status: 400 });
  }

  const active = await prisma.generation.count({
    where: {
      status: { in: ["QUEUED", "PROCESSING"] },
      createdAt: { gt: new Date(Date.now() - ACTIVE_WINDOW_MS) },
      ...(actor.userId ? { userId: actor.userId } : { guestId: actor.guestId, userId: null }),
    },
  });
  if (active >= MAX_ACTIVE_PER_ACTOR) return Response.json({ error: "too_many_active" }, { status: 429 });

  let generation;
  try {
    generation = await prisma.$transaction(async (tx) => {
      const cost = template.creditCost;
      if (actor.userId) {
        // Atomic check-and-deduct: the balance can never go negative.
        const charged = await tx.user.updateMany({
          where: { id: actor.userId, credits: { gte: cost } },
          data: { credits: { decrement: cost } },
        });
        if (charged.count === 0) throw new HttpError(402, "insufficient_credits", { required: cost });
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
    const taskId = await submitVideoEdit({
      templateVideoUrl: config.templateVideoUrl,
      imageUrls: uploadIds.map((id) => `${base}/api/uploads/${id}`),
      prompt: config.prompt,
      resolution: config.resolution,
      duration: config.duration,
      generateAudio: config.generateAudio,
    });
    await prisma.generation.update({
      where: { id: generation.id },
      data: { providerTaskId: taskId, status: "PROCESSING" },
    });
  } catch (e) {
    console.error("[generate] submit failed", e);
    await failGeneration(generation.id, "provider_submit_failed");
    return Response.json({ error: "generation_failed" }, { status: 502 });
  }

  return Response.json({ id: generation.id }, { status: 202 });
}
