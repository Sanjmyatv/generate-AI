import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

export type OAuthProvider = "google" | "apple";

interface OAuthIdentity {
  provider: OAuthProvider;
  providerAccountId: string;
  email?: string | null;
  emailVerified: boolean;
  name?: string | null;
}

function providerIdentity(provider: OAuthProvider, id: string) {
  return provider === "google" ? { googleId: id } : { appleId: id };
}

function newPublicId() {
  return `USR_${randomInt(100000, 1000000)}`;
}

/**
 * Resolves an OAuth identity to our internal user, so the same person signing in
 * with Google and Apple does not end up with two accounts when the email matches.
 * Apple "Hide My Email" relay addresses will not match a Google email; that case
 * creates a separate account unless the user later links them.
 */
export async function findOrCreateUser(identity: OAuthIdentity) {
  const providerId = providerIdentity(identity.provider, identity.providerAccountId);
  const email = identity.email?.toLowerCase() ?? null;
  const name = identity.name?.trim() || email;

  const byProvider = await prisma.user.findUnique({ where: providerId });
  if (byProvider) return byProvider;

  // Only link by email when the provider has verified it, otherwise anyone could
  // take over an account by registering someone else's address.
  if (email && identity.emailVerified) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      return prisma.user.update({
        where: { id: byEmail.id },
        data: { ...providerId, name: byEmail.name ?? name },
      });
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.user.create({
        data: {
          publicId: newPublicId(),
          name,
          // An unverified email must not claim the unique email slot.
          email: identity.emailVerified ? email : null,
          ...providerId,
        },
      });
    } catch (e) {
      const isConflict =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!isConflict) throw e;
      // Either the publicId collided (retry) or a concurrent sign-in created this user.
      const existing = await prisma.user.findUnique({ where: providerId });
      if (existing) return existing;
    }
  }
  throw new Error("Could not allocate a unique user ID");
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}
