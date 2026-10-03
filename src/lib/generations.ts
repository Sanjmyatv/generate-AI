import { prisma } from "@/lib/db";
import type { Generation } from "@/generated/prisma/client";
import type { Actor } from "@/lib/actor";

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
    }
    return true;
  });
}

/** Records a finished video. Returns false if another request already did. */
export async function completeGeneration(id: string, outputUrl: string) {
  const res = await prisma.generation.updateMany({
    where: { id, status: { in: ["QUEUED", "PROCESSING"] } },
    data: { status: "COMPLETED", outputUrl, completedAt: new Date() },
  });
  return res.count === 1;
}
