import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/auth";

const GUEST_COOKIE = "guest_id";

/** Who is making a request: a signed-in user, an anonymous guest, or both. */
export interface Actor {
  userId: string | null;
  guestId: string | null;
  /** Owner keys this actor may access (user first, then guest session). */
  keys: string[];
}

function buildActor(userId: string | null, guestId: string | null): Actor {
  const keys: string[] = [];
  if (userId) keys.push(`u:${userId}`);
  if (guestId) keys.push(`g:${guestId}`);
  return { userId, guestId, keys };
}

/**
 * Resolves the caller. A guest cookie is kept even after login so a generation
 * made before signing in can still be claimed by the new account.
 * Pass `createGuest` on write endpoints to mint a guest session if none exists.
 */
export async function getActor({ createGuest = false } = {}): Promise<Actor> {
  const [session, jar] = await Promise.all([auth(), cookies()]);
  const userId = session?.user?.id ?? null;
  let guestId = jar.get(GUEST_COOKIE)?.value ?? null;

  if (!guestId && createGuest) {
    guestId = randomUUID();
    jar.set(GUEST_COOKIE, guestId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return buildActor(userId, guestId);
}

/** Public base URL, used to build links the AI provider can fetch. */
export function getBaseUrl(req: Request) {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    // A typo such as "ttps://..." would make the provider reject every image URL.
    if (/^https?:\/\/[^/\s]+/i.test(configured)) return configured.replace(/\/+$/, "");
    console.error("[config] APP_URL is not a valid http(s) URL, falling back to request headers");
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
