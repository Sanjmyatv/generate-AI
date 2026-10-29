import { prisma } from "@/lib/db";
import { getActor } from "@/lib/actor";
import { claimLookup, toPublicPayment, verifyPayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

/** At most one QPay lookup per payment in this many seconds. */
const MIN_SECONDS_BETWEEN_CHECKS = 10;

/**
 * POST /api/payments/:id/check
 *
 * "I have paid": asks QPay once whether this payment arrived, for when the callback didn't.
 * QPay forbids polling, so this is rate limited and only runs when the customer presses the button.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = await getActor();
  if (!actor.userId) return Response.json({ error: "login_required" }, { status: 401 });

  let payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment || payment.userId !== actor.userId) return Response.json({ error: "not_found" }, { status: 404 });

  if (payment.status === "PENDING") {
    if (!(await claimLookup(payment.id, MIN_SECONDS_BETWEEN_CHECKS))) {
      return Response.json({ error: "too_soon", payment: toPublicPayment(payment) }, { status: 429 });
    }
    try {
      await verifyPayment(payment);
    } catch (e) {
      console.error("[payments] manual check failed", payment.id, e);
      return Response.json({ error: "provider_error", payment: toPublicPayment(payment) }, { status: 502 });
    }
    payment = (await prisma.payment.findUnique({ where: { id } })) ?? payment;
  }

  const balance =
    payment.status === "SUCCEEDED"
      ? (await prisma.user.findUnique({ where: { id: actor.userId }, select: { credits: true } }))?.credits
      : undefined;
  return Response.json({ payment: toPublicPayment(payment), balance });
}
