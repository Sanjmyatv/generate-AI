import { prisma } from "@/lib/db";
import { Prisma, type Payment } from "@/generated/prisma/client";
import { checkInvoice, createInvoice, getPayment, qpayConfigured, type QPayInvoice } from "@/lib/qpay";

/** A pending purchase of the same pack within this window reuses its QR instead of a new invoice. */
const REUSE_WINDOW_MS = 15 * 60 * 1000;
const MAX_PURCHASES_PER_HOUR = 10;

export class PaymentError extends Error {
  constructor(readonly code: "not_configured" | "package_unavailable" | "too_many" | "provider_error") {
    super(code);
  }
}

/** What the browser may see of a payment. */
export interface PublicPayment {
  id: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  amountMnt: number;
  credits: number;
  /** Only while pending: what the customer needs to pay. */
  qrImage?: string;
  qrText?: string;
  shortUrl?: string | null;
  deeplinks?: QPayInvoice["deeplinks"];
}

export function toPublicPayment(p: Payment): PublicPayment {
  const invoice = p.invoice as unknown as QPayInvoice | null;
  return {
    id: p.id,
    status: p.status,
    amountMnt: p.amountMnt,
    credits: p.credits,
    ...(p.status === "PENDING" && invoice
      ? { qrImage: invoice.qrImage, qrText: invoice.qrText, shortUrl: invoice.shortUrl, deeplinks: invoice.deeplinks }
      : {}),
  };
}

/**
 * Starts buying a credit pack: records a pending payment and asks QPay for an invoice. The price
 * and credits come from the pack in the database, never from the request.
 */
export async function startPackagePurchase(input: {
  userId: string;
  packageId: string;
  /** Public base URL of this app, for the callback QPay calls when the payment arrives. */
  baseUrl: string;
}): Promise<PublicPayment> {
  if (!qpayConfigured()) throw new PaymentError("not_configured");
  const pack = await prisma.creditPackage.findFirst({ where: { id: input.packageId, active: true } });
  if (!pack) throw new PaymentError("package_unavailable");

  const existing = await prisma.payment.findFirst({
    where: {
      userId: input.userId,
      packageId: pack.id,
      status: "PENDING",
      providerRef: { not: null },
      createdAt: { gt: new Date(Date.now() - REUSE_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return toPublicPayment(existing);

  const recent = await prisma.payment.count({
    where: { userId: input.userId, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_PURCHASES_PER_HOUR) throw new PaymentError("too_many");

  const payment = await prisma.payment.create({
    data: { userId: input.userId, packageId: pack.id, amountMnt: pack.priceMnt, credits: pack.credits, status: "PENDING" },
  });
  try {
    const invoice = await createInvoice({
      senderInvoiceNo: payment.id,
      receiverCode: input.userId,
      description: `zyro.ai ${pack.name}: ${pack.credits} credits`,
      amount: pack.priceMnt,
      callbackUrl: `${input.baseUrl}/api/payments/callback?pid=${payment.id}`,
    });
    const saved = await prisma.payment.update({
      where: { id: payment.id },
      data: { providerRef: invoice.invoiceId, invoice: invoice as unknown as Prisma.InputJsonObject },
    });
    return toPublicPayment(saved);
  } catch (e) {
    console.error("[payments] invoice failed", payment.id, e);
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    throw new PaymentError("provider_error");
  }
}

/**
 * Marks a payment paid and adds its credits. Idempotent: only the call that flips the status
 * pays out, so a repeated callback or a manual check can never credit twice.
 */
async function settle(payment: Payment, qpayPaymentId: string) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "SUCCEEDED", paidAt: new Date(), qpayPaymentId },
    });
    if (claimed.count === 0) return false;
    await tx.user.update({ where: { id: payment.userId }, data: { credits: { increment: payment.credits } } });
    await tx.creditLedger.create({
      data: { userId: payment.userId, delta: payment.credits, reason: "PURCHASE", paymentId: payment.id },
    });
    return true;
  });
}

/**
 * Asks QPay whether this payment was paid and credits it if so. With `qpayPaymentId` (from the
 * callback) that one payment is fetched and must belong to this invoice, be PAID and cover the
 * price; without it the invoice's payments are checked. Nothing here trusts the caller: the
 * answer comes from QPay.
 */
export async function verifyPayment(payment: Payment, qpayPaymentId?: string | null): Promise<boolean> {
  if (payment.status !== "PENDING") return payment.status === "SUCCEEDED";
  if (!payment.providerRef) return false;

  if (qpayPaymentId) {
    const paid = await getPayment(qpayPaymentId);
    if (paid.objectId !== payment.providerRef || paid.status !== "PAID" || !(paid.amount >= payment.amountMnt)) {
      return false;
    }
    await settle(payment, paid.paymentId);
    return true;
  }

  const check = await checkInvoice(payment.providerRef);
  const paid = check.payments.find((p) => p.status === "PAID");
  if (!paid || !(check.paidAmount >= payment.amountMnt)) return false;
  await settle(payment, paid.paymentId);
  return true;
}

/** Lets only one QPay lookup per payment through every `minSeconds`, whoever asks. */
export async function claimLookup(paymentId: string, minSeconds: number) {
  const now = new Date();
  const claimed = await prisma.payment.updateMany({
    where: {
      id: paymentId,
      status: "PENDING",
      OR: [{ lastCheckAt: null }, { lastCheckAt: { lt: new Date(now.getTime() - minSeconds * 1000) } }],
    },
    data: { lastCheckAt: now },
  });
  return claimed.count === 1;
}
