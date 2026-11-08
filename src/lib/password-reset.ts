import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/mailer";
import { hashPassword } from "@/lib/password";
import type { T } from "@/lib/i18n/translate";
import { EMAIL_PATTERN, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, normalizeEmail } from "@/lib/users";

const TOKEN_TTL_MS = 60 * 60 * 1000;
/** Reset emails one account can be sent per hour, so the form can't be used to flood an inbox. */
const MAX_REQUESTS_PER_HOUR = 3;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Emails a reset link to an email + password account. Says nothing about whether the address
 * has an account: the caller shows the same message either way. Google-only accounts have no
 * password to reset, so they get no email.
 */
export async function requestPasswordReset(emailInput: unknown, baseUrl: string, t: T): Promise<void> {
  const email = normalizeEmail(emailInput);
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) return;

  const recent = await prisma.passwordResetToken.count({
    where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recent >= MAX_REQUESTS_PER_HOUR) return;

  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    // Only the newest link works. Older ones are marked used, not deleted, so they still count
    // toward the hourly limit.
    prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    }),
  ]);

  const link = `${baseUrl}/reset-password?token=${token}`;
  const sent = await sendEmail({
    to: email,
    subject: t("mail.reset.subject"),
    text: `${t("mail.reset.intro")}\n\n${t("mail.reset.action")}: ${link}\n${t("mail.reset.expiry")}\n\n${t("mail.reset.ignore")}`,
    html: `<p>${t("mail.reset.intro")}</p><p><a href="${link}">${t("mail.reset.action")}</a><br>${t("mail.reset.expiry")}</p><p>${t("mail.reset.ignore")}</p>`,
  });
  if (!sent && process.env.NODE_ENV !== "production") console.log(`[dev] password reset link for ${email}: ${link}`);
}

/** True when the token exists, is unused and has not expired. */
export async function isResetTokenValid(token: string): Promise<boolean> {
  if (!token || token.length > 200) return false;
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  return Boolean(row && !row.usedAt && row.expiresAt > new Date());
}

export type ResetResult =
  | { ok: true; email: string }
  | { ok: false; error: "invalid_token" | "weak_password" };

/** Sets the new password and uses up the token, atomically, so one link cannot be used twice. */
export async function resetPassword(token: string, password: unknown): Promise<ResetResult> {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: "weak_password" };
  }
  if (!token || token.length > 200) return { ok: false, error: "invalid_token" };

  const passwordHash = await hashPassword(password);
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { tokenHash: hashToken(token), usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) return { ok: false, error: "invalid_token" } as const;

    const row = await tx.passwordResetToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { id: true, email: true } } },
    });
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } });
    return { ok: true, email: row.user.email ?? "" } as const;
  });
}
