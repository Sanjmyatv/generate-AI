import { prisma } from "@/lib/db";
import { getActor } from "@/lib/actor";
import { canAccess, claimIfGuest, refreshGeneration } from "@/lib/generations";

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

  gen = await refreshGeneration(gen);

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
