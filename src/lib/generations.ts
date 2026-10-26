import { prisma } from "@/lib/db";
import type { Generation } from "@/generated/prisma/client";
import type { Actor } from "@/lib/actor";
import { getTask } from "@/lib/seedance";
import { getHiggsfieldTask, isHiggsfieldConfig } from "@/lib/higgsfield";

/** A job still running after this long is treated as failed (and refunded). */
export const GENERATION_TIMEOUT_MS = 15 * 60 * 1000;

export function canAccess(gen: Pick<Generation, "userId" | "guestId">, actor: Actor) {
  if (actor.userId && gen.userId === actor.userId) return true;
  return Boolean(actor.guestId && gen.guestId === actor.guestId && !gen.userId);
}

/**
 * Attaches a guest-made generation to the account that just signed in, so the
 * result survives the login redirect.
 */
export async function claimIfGuest(gen: Generation, actor: Actor) {
  if (actor.userId && !gen.userId && actor.guestId && gen.guestId === actor.guestId) {
    return prisma.generation.update({ where: { id: gen.id }, data: { userId: actor.userId } });
  }
  return gen;
}

/**
 * Attaches every generation made as this browser's guest to the signed-in account. The
 * `?g=` redirect only rescues the one generation being viewed when the user logs in, so
 * logging in from History or Profile would otherwise leave guest creations behind.
 */
export async function claimGuestGenerations(actor: Actor) {
  if (!actor.userId || !actor.guestId) return;
  await prisma.generation.updateMany({
    where: { guestId: actor.guestId, userId: null },
    data: { userId: actor.userId },
  });
}

/**
 * Marks a generation failed and refunds any credits that were charged.
 * Idempotent: only the call that flips the status performs the refund, so
 * concurrent polls cannot refund twice.
 */
export async function failGeneration(id: string, error: string) {
  return prisma.$transaction(async (tx) => {
    const flipped = await tx.generation.updateMany({
      where: { id, status: { in: ["QUEUED", "PROCESSING"] } },
      data: { status: "FAILED", error, completedAt: new Date() },
    });
    if (flipped.count === 0) return false;

    const gen = await tx.generation.findUniqueOrThrow({ where: { id } });
    if (gen.userId && gen.creditCost > 0) {
      await tx.user.update({
        where: { id: gen.userId },
        data: { credits: { increment: gen.creditCost } },
      });
      await tx.creditLedger.create({
        data: {
          userId: gen.userId,
          delta: gen.creditCost,
          reason: "REFUND",
          generationId: gen.id,
        },
      });
      await tx.generation.update({ where: { id }, data: { refundedAt: new Date() } });
    }
    return true;
  });
}

const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

/** The result's media type: the provider's header if usable, else sniffed from the bytes. */
function resultContentType(header: string | null, data: Uint8Array) {
  const type = header?.split(";")[0].trim().toLowerCase() ?? "";
  if (type.startsWith("video/") || type.startsWith("image/")) return type;
  if (data[0] === 0x89 && data[1] === 0x50) return "image/png";
  if (data[0] === 0xff && data[1] === 0xd8) return "image/jpeg";
  if (data[0] === 0x52 && data[1] === 0x49 && data[8] === 0x57) return "image/webp"; // RIFF....WEBP
  return "video/mp4";
}

/** File extension for a stored result's media type. */
export function resultExtension(contentType: string) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  return "mp4";
}

/**
 * Copies the provider's finished video or image into our database; provider URLs expire, so
 * this is what keeps History and Download working later. Best effort: on failure the media
 * route still proxies the provider URL while it is valid.
 */
export async function archiveVideo(id: string, url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(90_000), cache: "no-store" });
    if (!res.ok) return false;
    if (Number(res.headers.get("content-length")) > MAX_VIDEO_BYTES) return false;
    const data = new Uint8Array(await res.arrayBuffer());
    if (data.byteLength === 0 || data.byteLength > MAX_VIDEO_BYTES) return false;
    await prisma.generationVideo.upsert({
      where: { generationId: id },
      update: {},
      create: {
        generationId: id,
        contentType: resultContentType(res.headers.get("content-type"), data),
        size: data.byteLength,
        data,
      },
    });
    return true;
  } catch (e) {
    console.error("[generations] archive failed", id, e);
    return false;
  }
}

/** Records a finished video. Returns false if another request already did. */
export async function completeGeneration(id: string, outputUrl: string) {
  const res = await prisma.generation.updateMany({
    where: { id, status: { in: ["QUEUED", "PROCESSING"] } },
    data: { status: "COMPLETED", outputUrl, completedAt: new Date() },
  });
  return res.count === 1;
}

/**
 * Syncs a running generation with its provider: completes it (and copies the result),
 * fails it (and refunds), or times it out. Returns the fresh row. Safe to call from any
 * request; only the call that flips the status acts on it.
 */
export async function refreshGeneration(gen: Generation): Promise<Generation> {
  if (gen.status !== "QUEUED" && gen.status !== "PROCESSING") return gen;

  if (Date.now() - gen.createdAt.getTime() > GENERATION_TIMEOUT_MS) {
    await failGeneration(gen.id, "timeout");
  } else if (gen.providerTaskId) {
    try {
      // The template decides which provider owns this task id.
      const template = await prisma.template.findUnique({
        where: { id: gen.templateId },
        select: { generationConfig: true },
      });
      const task = isHiggsfieldConfig(template?.generationConfig)
        ? await getHiggsfieldTask(gen.providerTaskId)
        : await getTask(gen.providerTaskId);
      if (task.status === "completed") {
        // Only the call that flips the status copies the result, so polls can't duplicate it.
        if (await completeGeneration(gen.id, task.videoUrl)) await archiveVideo(gen.id, task.videoUrl);
      } else if (task.status === "failed") {
        await failGeneration(gen.id, task.error);
      }
    } catch (e) {
      // Transient provider/network errors: keep the job running and let the next call retry.
      console.error("[generations] provider poll failed", gen.id, e);
    }
  }
  return (await prisma.generation.findUnique({ where: { id: gen.id } })) ?? gen;
}
