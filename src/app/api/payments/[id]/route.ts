import { prisma } from "@/lib/db";
import { getActor } from "@/lib/actor";
import { toPublicPayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * GET /api/payments/:id
 *
 * The payment's status from our own database. It never calls QPay, so the page can ask as
 * often as it likes while the callback does the confirming. Once paid it includes the new balance.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = await getActor();
  if (!actor.userId) return Response.json({ error: "login_required" }, { status: 401 });

  const payment = await prisma.payment.findUnique({ where: { id } });
  // 404 rather than 403 so ids cannot be probed.
  if (!payment || payment.userId !== actor.userId) return Response.json({ error: "not_found" }, { status: 404 });

  const balance =
    payment.status === "SUCCEEDED"
      ? (await prisma.user.findUnique({ where: { id: actor.userId }, select: { credits: true } }))?.credits
      : undefined;
  return Response.json({ payment: toPublicPayment(payment), balance });
}
