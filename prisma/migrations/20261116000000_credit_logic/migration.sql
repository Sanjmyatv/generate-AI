-- One credit formula for the whole site: admin-editable pricing settings, a flag for templates priced
-- automatically, and pack data (Mongolian name, queue-priority rows) the pricing page and admin read.
-- No balance, ledger row or payment is touched.

-- AlterTable
ALTER TABLE "PricingSetting" ALTER COLUMN "gatewayFeeRate" SET DEFAULT 0.01,
ADD COLUMN     "creditValueMnt" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "hdMultiplier" DECIMAL(6,3) NOT NULL DEFAULT 2.015,
ADD COLUMN     "listUsdPerSecond" DECIMAL(8,5) NOT NULL DEFAULT 0.10667,
ADD COLUMN     "priceSource" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "referenceSeconds" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "targetMarginPct" DECIMAL(5,2) NOT NULL DEFAULT 55,
ADD COLUMN     "usdMntRate" DECIMAL(10,2),
ADD COLUMN     "videoUsdPerSecond" DECIMAL(8,4) NOT NULL DEFAULT 0.074;

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "autoCredits" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CreditPackage" ADD COLUMN     "nameMn" TEXT,
ADD COLUMN     "priorityQueue" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "topPriorityQueue" BOOLEAN NOT NULL DEFAULT false;

-- Lite becomes 10,000₮ for 100 credits (still ₮100 per credit); the Mongolian names move into the table.
UPDATE "CreditPackage" SET "priceMnt" = 10000, "credits" = 100, "bonusCredits" = 0 WHERE "id" = 'light';
UPDATE "CreditPackage" SET "nameMn" = 'Туршилтын багц' WHERE "id" = 'trial';
UPDATE "CreditPackage" SET "nameMn" = 'Лайт бүтээгчийн багц' WHERE "id" = 'light';
UPDATE "CreditPackage" SET "nameMn" = 'Про бүтээгчийн багц', "priorityQueue" = true WHERE "id" = 'pro';
UPDATE "CreditPackage" SET "nameMn" = 'Бизнесийн багц', "priorityQueue" = true, "topPriorityQueue" = true WHERE "id" = 'business';
