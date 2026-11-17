/**
 * Reprices video templates with the credit formula and the saved pricing settings.
 *
 *   npm run reprice                      dry run: prints what would change, changes nothing
 *   npm run reprice -- --apply           applies it to templates priced automatically
 *   npm run reprice -- --apply --include=a,b   also applies it to those templates priced by hand (after you review them)
 *
 * Templates priced by hand are never touched unless they are named in --include.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { toPricingConfig } from "../src/lib/pricing-config";
import { changeData, planRepricing, type PriceChange } from "../src/lib/repricing";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const fmt = (n: number | null) => (n === null ? "-" : String(n));
const table = (rows: PriceChange[]) =>
  console.table(
    rows.map((r) => ({
      template: `${r.name} (${r.id})`,
      length: r.seconds === null ? "image" : `${r.seconds} s`,
      "old → new credits": r.lines.map((l) => `${l.label} ${fmt(l.oldCredits)} → ${fmt(l.newCredits)}`).join(", "),
    })),
  );

async function main() {
  const apply = process.argv.includes("--apply");
  const include = new Set((process.argv.find((a) => a.startsWith("--include="))?.slice("--include=".length) ?? "").split(",").filter(Boolean));

  const cfg = toPricingConfig(await prisma.pricingSetting.findUnique({ where: { id: "default" } }));
  console.log(`Settings: ${cfg.creditValueMnt}₮/credit, margin video ${cfg.targetMarginPct}% / images ${cfg.targetMarginImagesPct}%, retry ${cfg.retryRate * 100}%, gateway ${cfg.gatewayFeeRate * 100}%, $${cfg.videoUsdPerSecond}/s, 720p x${cfg.hdMultiplier}, ${cfg.usdMnt}₮/$`);

  const templates = await prisma.template.findMany({ orderBy: { name: "asc" } });
  const { auto, manual } = planRepricing(
    templates.map((t) => ({
      ...t,
      creditCost: Number(t.creditCost),
      creditCostHd: t.creditCostHd === null ? null : Number(t.creditCostHd),
      creditCost2k: t.creditCost2k === null ? null : Number(t.creditCost2k),
      creditCost4k: t.creditCost4k === null ? null : Number(t.creditCost4k),
    })),
    cfg,
  );

  console.log(`\nPriced automatically, would change (${auto.length}):`);
  if (auto.length) table(auto);
  else console.log("  none");
  console.log(`\nPriced by hand, NOT touched; what the formula would say (${manual.length}):`);
  if (manual.length) table(manual);
  else console.log("  none");

  const targets = [...auto, ...manual.filter((m) => include.has(m.id) && m.differs)];
  if (!apply) {
    console.log("\nDry run: nothing was changed. Add --apply to apply the automatic ones.");
    return;
  }
  for (const c of targets) {
    await prisma.template.update({ where: { id: c.id }, data: { ...changeData(c), autoCredits: true } });
  }
  console.log(`\nApplied to ${targets.length} template(s).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
