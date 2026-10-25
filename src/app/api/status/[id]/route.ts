import { prisma } from "@/lib/db";
import { getActor } from "@/lib/actor";
import {
  GENERATION_TIMEOUT_MS,
  archiveVideo,
  canAccess,
  claimIfGuest,
  completeGeneration,
  failGeneration,
} from "@/lib/generations";
import { getTask } from "@/lib/seedance";
import { getHiggsfieldTask, isHiggsfieldConfig } from "@/lib/higgsfield";

export const dynamic = "force-dynamic";

/**
 * GET /api/status/:id — our own generation id (never the provider's task id).
 * Each poll refreshes the provider's state, so no webhook or worker is needed.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = await getActor();

  let gen = await prisma.generation.findUnique({ where: { id } });
  // 404 (not 403) so ids cannot be probed.
  if (!gen || !canAccess(gen, actor)) return Response.json({ error: "not_found" }, { status: 404 });
  gen = await claimIfGuest(gen, actor);

  if ((gen.status === "QUEUED" || gen.status === "PROCESSING") && gen.providerTaskId) {
    if (Date.now() - gen.createdAt.getTime() > GENERATION_TIMEOUT_MS) {
      await failGeneration(gen.id, "timeout");
    } else {
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
          // Only the poll that flips the status copies the video, so polls can't duplicate it.
          if (await completeGeneration(gen.id, task.videoUrl)) await archiveVideo(gen.id, task.videoUrl);
        } else if (task.status === "failed") await failGeneration(gen.id, task.error);
      } catch (e) {
        // Transient provider/network errors: keep the job running and let the next poll retry.
        console.error("[status] provider poll failed", e);
      }
    }
    gen = (await prisma.generation.findUnique({ where: { id } })) ?? gen;
  }

  return Response.json({
    id: gen.id,
    status: gen.status,
    templateId: gen.templateId,
    // Served through our proxy so the provider URL stays private.
    videoUrl: gen.status === "COMPLETED" ? `/api/generations/${gen.id}/video` : null,
    error: gen.status === "FAILED" ? gen.error : null,
    refunded: gen.status === "FAILED" && Boolean(gen.userId) && gen.creditCost > 0,
  });
}
