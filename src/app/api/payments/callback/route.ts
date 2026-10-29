import { prisma } from "@/lib/db";
import { claimLookup, verifyPayment } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * GET /api/payments/callback?pid=<our payment id>&qpay_payment_id=<QPay's payment id>
 *
 * QPay calls this when someone pays. Anyone can call it, so nothing in the query is trusted:
 * the payment is confirmed by asking QPay, and credited at most once. QPay requires exactly
 * "200 SUCCESS" as the answer, so that is what it gets even when our own handling failed (the
 * customer can then use "I have paid" to trigger a check).
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const pid = params.get("pid");
  const qpayPaymentId = params.get("qpay_payment_id") ?? params.get("payment_id");

  try {
    if (pid) {
      const payment = await prisma.payment.findUnique({ where: { id: pid } });
      if (payment?.status === "PENDING" && (await claimLookup(payment.id, 3))) {
        await verifyPayment(payment, qpayPaymentId);
      }
    }
  } catch (e) {
    console.error("[payments] callback failed", pid, e);
  }
  return new Response("SUCCESS", { status: 200, headers: { "Content-Type": "text/plain" } });
}
