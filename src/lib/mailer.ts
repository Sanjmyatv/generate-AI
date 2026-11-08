/**
 * Sends transactional email through Resend (https://resend.com), server-side only.
 *
 *     RESEND_API_KEY  API key from the Resend dashboard
 *     EMAIL_FROM      sender on a domain verified in Resend, e.g. "zyro.ai <no-reply@zyro.one>"
 */
const REQUEST_TIMEOUT_MS = 15_000;

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Returns true when Resend accepted the message. Never throws: callers must not leak failures to users. */
export async function sendEmail(email: Email): Promise<boolean> {
  if (!emailConfigured()) {
    console.error("[mail] RESEND_API_KEY / EMAIL_FROM are not set, email not sent");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, ...email, to: [email.to] }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[mail] Resend responded with ${res.status}`, (await res.text().catch(() => "")).slice(0, 500));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[mail] send failed", e);
    return false;
  }
}
