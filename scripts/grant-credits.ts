/**
 * Adds (or, with a negative amount, removes) credits on one account by its public ID, with a ledger entry.
 *
 *   npm run grant-credits -- --user=USR_976989 --amount=1000            dry run: shows the account, changes nothing
 *   npm run grant-credits -- --user=USR_976989 --amount=1000 --apply    adds the credits
 *
 * Uses DATABASE_URL like the app. The change is recorded in the credit ledger as an ADJUSTMENT.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

async function main() {
  const publicId = arg("user")?.trim().toUpperCase();
  const amount = Number(arg("amount"));
  const apply = process.argv.includes("--apply");
  if (!publicId || !/^USR_\d+$/.test(publicId) || !Number.isFinite(amount) || amount === 0 || Math.abs(amount) > 100000) {
    throw new Error("Usage: --user=USR_123456 --amount=1000 [--apply]  (amount between -100000 and 100000, not 0)");
  }

  const user = await prisma.user.findUnique({ where: { publicId }, select: { id: true, email: true, name: true, credits: true } });
  if (!user) throw new Error(`No account with ID ${publicId}.`);
  const before = Number(user.credits);
  console.log(`${publicId}: ${user.name ?? "-"} <${user.email ?? "-"}>, balance ${before} credits`);
  if (before + amount < 0) throw new Error(`That would leave ${before + amount} credits.`);

  if (!apply) {
    console.log(`Dry run: would change the balance by ${amount} to ${before + amount}. Run again with --apply.`);
    return;
  }
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id: user.id }, data: { credits: { increment: amount } }, select: { credits: true } });
    await tx.creditLedger.create({ data: { userId: user.id, delta: amount, reason: "ADJUSTMENT" } });
    return u;
  });
  console.log(`Done: ${publicId} now has ${Number(updated.credits)} credits.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
