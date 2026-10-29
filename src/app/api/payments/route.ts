import { getActor, getBaseUrl } from "@/lib/actor";
import { PaymentError, startPackagePurchase } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * POST /api/payments  { packageId }
 *
 * Starts a QPay purchase of a credit pack for the signed-in user and returns the QR code and
 * bank links. The credits arrive when QPay confirms the payment (see /api/payments/callback).
 */
export async function POST(req: Request) {
  const actor = await getActor();
  if (!actor.userId) return Response.json({ error: "login_required" }, { status: 401 });

  let body: { packageId?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (typeof body.packageId !== "string") return Response.json({ error: "invalid_request" }, { status: 400 });

  try {
    const payment = await startPackagePurchase({
      userId: actor.userId,
      packageId: body.packageId,
      baseUrl: getBaseUrl(req),
    });
    return Response.json({ payment });
  } catch (e) {
    if (e instanceof PaymentError) {
      const status = { not_configured: 503, package_unavailable: 404, too_many: 429, provider_error: 502 }[e.code];
      return Response.json({ error: e.code }, { status });
    }
    throw e;
  }
}
