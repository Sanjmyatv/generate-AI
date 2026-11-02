import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { Prisma, type User } from "@/generated/prisma/client";
import { SIGNUP_BONUS_CREDITS } from "@/config/pricing";
import { hashPassword, verifyPassword } from "@/lib/password";

export type OAuthProvider = "google";

interface OAuthIdentity {
  provider: OAuthProvider;
  providerAccountId: string;
  email?: string | null;
  emailVerified: boolean;
  name?: string | null;
}

function providerIdentity(_provider: OAuthProvider, id: string) {
  return { googleId: id };
}

function newPublicId() {
  return `USR_${randomInt(100000, 1000000)}`;
}

/**
 * Gives a Google account its free signup credits, once. Run on every OAuth sign-in so
 * an account that missed the grant (an earlier failure, or an account from before the bonus
 * existed) gets it next time. Email + password accounts are not eligible: their email isn't
 * verified, so anyone could mint free credits with throwaway addresses.
 */
async function grantSignupBonus(user: User): Promise<User> {
  if (user.signupBonusAt) return user;
  await prisma.$transaction(async (tx) => {
    // The claim is atomic, so concurrent sign-ins cannot grant it twice.
    const claimed = await tx.user.updateMany({
      where: { id: user.id, signupBonusAt: null },
      data: { signupBonusAt: new Date(), credits: { increment: SIGNUP_BONUS_CREDITS } },
    });
    if (claimed.count === 1) {
      await tx.creditLedger.create({
        data: { userId: user.id, delta: SIGNUP_BONUS_CREDITS, reason: "BONUS" },
      });
    }
  });
  return prisma.user.findUniqueOrThrow({ where: { id: user.id } });
}

/**
 * Resolves an OAuth identity to our internal user, so someone who first signed up with
 * email + password does not end up with two accounts when they continue with Google
 * and the (verified) email matches.
 */
export async function findOrCreateUser(identity: OAuthIdentity) {
  const providerId = providerIdentity(identity.provider, identity.providerAccountId);
  const email = identity.email?.toLowerCase() ?? null;
  const name = identity.name?.trim() || email;

  const byProvider = await prisma.user.findUnique({ where: providerId });
  if (byProvider) return grantSignupBonus(byProvider);

  // Only link by email when the provider has verified it, otherwise anyone could
  // take over an account by registering someone else's address.
  if (email && identity.emailVerified) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      const linked = await prisma.user.update({
        where: { id: byEmail.id },
        // Password sign-up doesn't verify the email, so someone could have registered an
        // address that isn't theirs. The provider just verified it: drop any password so
        // only the real owner keeps access.
        data: { ...providerId, name: byEmail.name ?? name, passwordHash: null },
      });
      return grantSignupBonus(linked);
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const created = await prisma.user.create({
        data: {
          publicId: newPublicId(),
          name,
          // An unverified email must not claim the unique email slot.
          email: identity.emailVerified ? email : null,
          ...providerId,
        },
      });
      return await grantSignupBonus(created);
    } catch (e) {
      const isConflict =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!isConflict) throw e;
      // Either the publicId collided (retry) or a concurrent sign-in created this user.
      const existing = await prisma.user.findUnique({ where: providerId });
      if (existing) return grantSignupBonus(existing);
    }
  }
  throw new Error("Could not allocate a unique user ID");
}

export const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export type SignUpResult =
  | { ok: true }
  | { ok: false; error: "invalid_email" | "weak_password" | "email_taken" };

/**
 * Creates an email + password account. An address that already has any account (including
 * a Google one) is refused, never given a password, so nobody can take over an
 * existing account by signing up with its email.
 */
export async function createPasswordUser(emailInput: unknown, password: unknown): Promise<SignUpResult> {
  const email = normalizeEmail(emailInput);
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return { ok: false, error: "invalid_email" };
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: "weak_password" };
  }
  if (await prisma.user.findUnique({ where: { email } })) return { ok: false, error: "email_taken" };

  const passwordHash = await hashPassword(password);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await prisma.user.create({ data: { publicId: newPublicId(), name: email, email, passwordHash } });
      return { ok: true };
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      // Either the publicId collided (retry) or the email was just taken by a concurrent sign-up.
      if (await prisma.user.findUnique({ where: { email } })) return { ok: false, error: "email_taken" };
    }
  }
  throw new Error("Could not allocate a unique user ID");
}

/** Returns the user when the email + password match, otherwise null. */
export async function verifyPasswordLogin(emailInput: unknown, password: unknown) {
  const email = normalizeEmail(emailInput);
  if (!email || typeof password !== "string" || password.length > MAX_PASSWORD_LENGTH) return null;
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash ?? null);
  return ok ? user : null;
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
