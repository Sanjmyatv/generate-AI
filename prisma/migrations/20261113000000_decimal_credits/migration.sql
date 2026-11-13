-- Credits move to a new unit: 1 credit = 100 MNT (it used to be 1 MNT), with 2 decimals.
-- Only test accounts exist, so wallets and the credit history are cleared instead of converted.
-- Prices and generation costs keep their value: every amount is divided by 100.

DELETE FROM "CreditLedger";
UPDATE "User" SET "credits" = 0, "signupBonusAt" = NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "credits" DROP DEFAULT,
ALTER COLUMN "credits" SET DATA TYPE DECIMAL(10,2) USING "credits"::numeric,
ALTER COLUMN "credits" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "CreditLedger" ALTER COLUMN "delta" SET DATA TYPE DECIMAL(10,2) USING "delta"::numeric;

-- AlterTable
ALTER TABLE "Generation" ALTER COLUMN "creditCost" DROP DEFAULT,
ALTER COLUMN "creditCost" SET DATA TYPE DECIMAL(10,2) USING ROUND("creditCost"::numeric / 100, 2),
ALTER COLUMN "creditCost" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Template" ALTER COLUMN "creditCost" SET DATA TYPE DECIMAL(10,2) USING ROUND("creditCost"::numeric / 100, 2),
ALTER COLUMN "creditCostHd" SET DATA TYPE DECIMAL(10,2) USING ROUND("creditCostHd"::numeric / 100, 2),
ALTER COLUMN "creditCost2k" SET DATA TYPE DECIMAL(10,2) USING ROUND("creditCost2k"::numeric / 100, 2),
ALTER COLUMN "creditCost4k" SET DATA TYPE DECIMAL(10,2) USING ROUND("creditCost4k"::numeric / 100, 2);

-- Image templates move to the new default qualities: 3 credits at 1K, 6 at 2K, 10 at 4K (tiers a template does not offer stay empty).
UPDATE "Template" SET "creditCost" = 3,
  "creditCost2k" = CASE WHEN "creditCost2k" IS NOT NULL THEN 6 END,
  "creditCost4k" = CASE WHEN "creditCost4k" IS NOT NULL THEN 10 END
WHERE type = 'IMAGE';

-- Packs and payments stay whole credits, in the new unit.
UPDATE "CreditPackage" SET "credits" = ROUND("credits" / 100.0), "bonusCredits" = ROUND("bonusCredits" / 100.0);
UPDATE "Payment" SET "credits" = ROUND("credits" / 100.0);

-- CreateTable
CREATE TABLE "PricingSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "retryBufferRate" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "gatewayFeeRate" DECIMAL(5,4) NOT NULL DEFAULT 0.015,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingSetting_pkey" PRIMARY KEY ("id")
);
