/**
 * Client for the QPay merchant API v2 (https://merchant.qpay.mn/v2). Server-side only: the
 * credentials must never reach the browser.
 *
 *   POST /auth/token        Basic auth (username:password)  -> access token
 *   POST /invoice           simple invoice                  -> invoice_id, QR, bank app links
 *   GET  /payment/{id}      one payment by QPay's payment id (what the callback gives us)
 *   POST /payment/check     payments of an invoice
 *
 * QPay forbids polling these endpoints (no cron jobs): a payment is confirmed when QPay calls
 * our callback URL, and a check is made only then, or when the customer asks for one.
 *
 * Configuration, all environment variables:
 *   QPAY_USERNAME, QPAY_PASSWORD   merchant credentials from QPay
 *   QPAY_INVOICE_CODE              the invoice code QPay created for the merchant
 *   QPAY_BASE_URL                  optional; defaults to the production API
 */

const DEFAULT_BASE_URL = "https://merchant.qpay.mn/v2";
const REQUEST_TIMEOUT_MS = 20_000;

export class QPayError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** QPay's error key, e.g. "INVOICE_CODE_INVALID". */
    readonly code?: string,
  ) {
    super(message);
    this.name = "QPayError";
  }
}

/**
 * The API root, e.g. https://merchant.qpay.mn/v2. A full endpoint pasted by mistake (the token
 * URL from QPay's welcome message) is trimmed back to the root: with a doubled path QPay answers
 * 401 NO_CREDENDIALS, which looks exactly like a bad login.
 */
export function normalizeBaseUrl(raw: string | undefined) {
  const trimmed = (raw || DEFAULT_BASE_URL).trim().replace(/\/+$/, "").replace(/\/auth\/token$/i, "");
  try {
    const url = new URL(trimmed);
    const path = url.pathname.replace(/\/+$/, "");
    return `${url.origin}${path || "/v2"}`;
  } catch {
    return DEFAULT_BASE_URL;
  }
}

/** An environment value without stray spaces or the quotes people sometimes paste around it. */
function cleanEnv(value: string | undefined) {
  return value?.trim().replace(/^(["'])(.*)\1$/, "$2").trim();
}

function config() {
  const username = cleanEnv(process.env.QPAY_USERNAME);
  const password = cleanEnv(process.env.QPAY_PASSWORD);
  const invoiceCode = cleanEnv(process.env.QPAY_INVOICE_CODE);
  if (!username || !password || !invoiceCode) throw new QPayError("QPay is not configured");
  return { username, password, invoiceCode, baseUrl: normalizeBaseUrl(process.env.QPAY_BASE_URL) };
}

/** True when the QPay credentials are set, so the UI can say payments aren't available yet. */
export function qpayConfigured() {
  return Boolean(process.env.QPAY_USERNAME && process.env.QPAY_PASSWORD && process.env.QPAY_INVOICE_CODE);
}

// QPay asks that tokens are not requested over and over, so one token is kept until shortly
// before it expires and concurrent requests share a single login.
let cachedToken: { value: string; expiresAt: number } | null = null;
let inFlightLogin: Promise<string> | null = null;

async function fetchJson(url: string, init: RequestInit): Promise<{ status: number; data: unknown }> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store" });
  } catch (e) {
    throw new QPayError(`QPay request failed: ${e instanceof Error ? e.message : e}`);
  }
  const text = await res.text().catch(() => "");
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // not JSON; handled by the caller through the status code
  }
  return { status: res.status, data };
}

function errorKey(data: unknown) {
  const d = data as { error?: unknown; message?: unknown } | null;
  return typeof d?.error === "string" ? d.error : typeof d?.message === "string" ? d.message : undefined;
}

async function login(): Promise<string> {
  const { username, password, baseUrl } = config();
  const { status, data } = await fetchJson(`${baseUrl}/auth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
  });
  const body = data as { access_token?: unknown; expires_in?: unknown } | null;
  if (status !== 200 || typeof body?.access_token !== "string") {
    // The URL is logged (it holds no secret) because a wrong base URL looks like a bad login.
    // Lengths, not values: an extra character (a quote, a space) shows up as a wrong length.
    console.error(
      "[qpay] login failed",
      status,
      errorKey(data) ?? "",
      `POST ${baseUrl}/auth/token`,
      `(username ${username.length} chars, password ${password.length} chars)`,
    );
    throw new QPayError(`QPay login failed (${status})`, status, errorKey(data));
  }
  // `expires_in` is documented as a timestamp in seconds; accept a plain duration too.
  const expires = Number(body.expires_in);
  const expiresAt =
    Number.isFinite(expires) && expires > 0
      ? expires > 1e9
        ? expires * 1000
        : Date.now() + expires * 1000
      : Date.now() + 30 * 60 * 1000;
  cachedToken = { value: body.access_token, expiresAt };
  return body.access_token;
}

async function getToken(force = false): Promise<string> {
  if (!force && cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value;
  inFlightLogin ??= login().finally(() => {
    inFlightLogin = null;
  });
  return inFlightLogin;
}

async function api(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
  const { baseUrl } = config();
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getToken(attempt > 0);
    const { status, data } = await fetchJson(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (status === 401 && attempt === 0) continue; // the token was revoked or expired: log in again once
    if (status < 200 || status >= 300) {
      console.error(`[qpay] ${method} ${path} ->`, status, errorKey(data) ?? "");
      throw new QPayError(`QPay responded with ${status}`, status, errorKey(data));
    }
    return data;
  }
  throw new QPayError("QPay rejected the login", 401);
}

export interface QPayInvoice {
  invoiceId: string;
  qrText: string;
  /** PNG, base64 encoded. */
  qrImage: string;
  shortUrl: string | null;
  /** Bank apps that open straight to this payment. */
  deeplinks: { name: string; description: string; logo: string; link: string }[];
}

export interface CreateInvoiceInput {
  /** Our payment id: unique, letters and digits only. */
  senderInvoiceNo: string;
  /** Who the invoice is for, unique per customer. */
  receiverCode: string;
  description: string;
  /** MNT. */
  amount: number;
  callbackUrl: string;
}

/** Creates a simple invoice and returns the QR code and payment links. */
export async function createInvoice(input: CreateInvoiceInput): Promise<QPayInvoice> {
  const { invoiceCode } = config();
  const data = (await api("POST", "/invoice", {
    invoice_code: invoiceCode,
    sender_invoice_no: input.senderInvoiceNo,
    invoice_receiver_code: input.receiverCode,
    invoice_description: input.description.slice(0, 255),
    amount: input.amount,
    callback_url: input.callbackUrl,
  })) as {
    invoice_id?: unknown;
    qr_text?: unknown;
    qr_image?: unknown;
    qPay_shortUrl?: unknown;
    urls?: unknown;
    qPay_deeplink?: unknown;
  } | null;

  if (typeof data?.invoice_id !== "string" || typeof data.qr_text !== "string" || typeof data.qr_image !== "string") {
    throw new QPayError("QPay did not return an invoice");
  }
  // The spec calls the bank list `qPay_deeplink`; some responses name it `urls`.
  const list = Array.isArray(data.qPay_deeplink) ? data.qPay_deeplink : Array.isArray(data.urls) ? data.urls : [];
  const deeplinks = (list as Record<string, unknown>[])
    .filter((l) => typeof l?.link === "string" && typeof l?.name === "string")
    .map((l) => ({
      name: String(l.name),
      description: typeof l.description === "string" ? l.description : String(l.name),
      logo: typeof l.logo === "string" ? l.logo : "",
      link: String(l.link),
    }));
  return {
    invoiceId: data.invoice_id,
    qrText: data.qr_text,
    qrImage: data.qr_image,
    shortUrl: typeof data.qPay_shortUrl === "string" ? data.qPay_shortUrl : null,
    deeplinks,
  };
}

export interface QPayPayment {
  paymentId: string;
  /** NEW, FAILED, PAID, PARTIAL or REFUNDED. */
  status: string;
  amount: number;
  /** The invoice this payment belongs to (when object_type is INVOICE). */
  objectId: string | null;
}

/** One payment by QPay's payment id: what the callback hands us. */
export async function getPayment(paymentId: string): Promise<QPayPayment> {
  const data = (await api("GET", `/payment/${encodeURIComponent(paymentId)}`)) as {
    payment_id?: unknown;
    payment_status?: unknown;
    payment_amount?: unknown;
    object_type?: unknown;
    object_id?: unknown;
  } | null;
  if (!data || typeof data.payment_status !== "string") throw new QPayError("QPay did not return the payment");
  return {
    paymentId: String(data.payment_id ?? paymentId),
    status: data.payment_status,
    amount: Number(data.payment_amount),
    objectId: data.object_type === "INVOICE" && typeof data.object_id === "string" ? data.object_id : null,
  };
}

/** The payments recorded against an invoice. Empty until someone pays. */
export async function checkInvoice(invoiceId: string): Promise<{ paidAmount: number; payments: QPayPayment[] }> {
  const data = (await api("POST", "/payment/check", {
    object_type: "INVOICE",
    object_id: invoiceId,
    offset: { page_number: 1, page_limit: 100 },
  })) as { paid_amount?: unknown; rows?: unknown } | null;
  const rows = Array.isArray(data?.rows) ? (data.rows as Record<string, unknown>[]) : [];
  return {
    paidAmount: Number(data?.paid_amount ?? 0) || 0,
    payments: rows.map((r) => ({
      paymentId: String(r.payment_id ?? ""),
      status: String(r.payment_status ?? ""),
      amount: Number(r.payment_amount),
      objectId: invoiceId,
    })),
  };
}
