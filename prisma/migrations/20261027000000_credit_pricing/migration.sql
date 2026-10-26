-- AlterEnum
ALTER TYPE "LedgerReason" ADD VALUE 'BONUS';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "signupBonusAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "creditCostHd" INTEGER,
ADD COLUMN     "durationSeconds" INTEGER;

-- AlterTable
ALTER TABLE "CreditPackage" ADD COLUMN     "bonusCredits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "highlighted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "resolution" TEXT NOT NULL DEFAULT '480p';

-- Credits now follow 1 credit = ₮1, so template prices move to the new scale (the old prices
-- were single digits). Images cost 100; videos use the 10 s or 20 s tier. Edit any template in
-- /admin to change its price afterwards.
UPDATE "Template" SET "creditCost" = 100 WHERE "type" = 'IMAGE';

UPDATE "Template"
SET "durationSeconds" = 20, "creditCost" = 6500, "creditCostHd" = 9000
WHERE "type" = 'VIDEO' AND "id" IN ('three-guys-dancing', 'shine');

UPDATE "Template"
SET "durationSeconds" = 10, "creditCost" = 3500, "creditCostHd" = 5000
WHERE "type" = 'VIDEO' AND "durationSeconds" IS NULL;
