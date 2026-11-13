-- Raise video templates that sell below what they cost to run (about 55% margin at ₮3,500 per $1,
-- 5% retry buffer, 1.5% gateway fee). Prices are only ever raised, so a price an admin already set
-- higher is left alone. Genjutsu (15 s source): $2.4-2.5 at 480p, $5.11 at 720p. Genjutsu Light: $1.50 / $3.00.
UPDATE "Template" SET
  "creditCost" = GREATEST("creditCost", 215),
  "creditCostHd" = CASE WHEN "creditCostHd" IS NOT NULL THEN GREATEST("creditCostHd", 435) END
WHERE type = 'VIDEO'
  AND "generationConfig"->>'provider' = 'genjutsu'
  AND COALESCE("generationConfig"->>'light', 'false') <> 'true'
  AND ("durationSeconds" IS NULL OR "durationSeconds" <= 15);

UPDATE "Template" SET
  "creditCost" = GREATEST("creditCost", 127),
  "creditCostHd" = CASE WHEN "creditCostHd" IS NOT NULL THEN GREATEST("creditCostHd", 255) END
WHERE type = 'VIDEO'
  AND "generationConfig"->>'provider' = 'genjutsu'
  AND "generationConfig"->>'light' = 'true'
  AND ("durationSeconds" IS NULL OR "durationSeconds" <= 15);
