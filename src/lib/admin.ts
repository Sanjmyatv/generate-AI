import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/**
 * The signed-in admin, or null. Admin status lives in `User.isAdmin`, set by hand in the
 * database: an email-based check would let someone register an admin's address first
 * (password sign-up doesn't verify email).
 */
export async function getAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, isAdmin: true },
  });
  return user?.isAdmin ? user : null;
}

/** For admin pages and actions: everyone else gets a 404, so the panel isn't discoverable. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) notFound();
  return admin;
}
