import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/credits — the signed-in user's current balance, so the header can stay live without a page reload. */
export async function GET() {
  const actor = await getActor();
  if (!actor.userId) return Response.json({ credits: null }, { headers: { "Cache-Control": "no-store" } });
  const user = await prisma.user.findUnique({ where: { id: actor.userId }, select: { credits: true } });
  return Response.json({ credits: user ? Number(user.credits) : null }, { headers: { "Cache-Control": "no-store" } });
}
