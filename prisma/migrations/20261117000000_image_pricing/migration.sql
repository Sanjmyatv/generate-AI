-- Image pricing joins the credit formula: its own target margin, the default quality tier (Low) and the
-- expected 1K Low cost. No balance, ledger row or payment is touched.

-- AlterTable
ALTER TABLE "PricingSetting" ADD COLUMN     "imageCostUsd1kLow" DECIMAL(8,4) NOT NULL DEFAULT 0.075,
ADD COLUMN     "imageQuality" TEXT NOT NULL DEFAULT 'low',
ADD COLUMN     "targetMarginImagesPct" DECIMAL(5,2) NOT NULL DEFAULT 55;

-- Existing image templates move to the Low quality tier rendered at 1K and are priced by the formula:
-- 7 credits at 1K (about $0.075 -> 700 MNT, ~60% margin). The old 2K / 4K prices (6 and 10 credits) lost
-- money and are cleared; a quality is offered again only once a verified provider cost exists for it.
UPDATE "Template" SET
  "creditCost" = 7,
  "creditCost2k" = NULL,
  "creditCost4k" = NULL,
  "autoCredits" = true,
  "generationConfig" = CASE
    WHEN "generationConfig" IS NULL THEN NULL
    ELSE jsonb_set(jsonb_set("generationConfig"::jsonb, '{quality}', '"low"'), '{resolution}', '"1k"')
  END
WHERE type = 'IMAGE';
