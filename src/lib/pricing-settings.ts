import { prisma } from "@/lib/db";
import { toPricingConfig } from "@/lib/pricing-config";
import type { PricingConfig } from "@/lib/pricing";

/** The settings the price formula uses: what the admin saved, else the defaults. */
export async function getPricingConfig(): Promise<PricingConfig> {
  return toPricingConfig(await prisma.pricingSetting.findUnique({ where: { id: "default" } }));
}
