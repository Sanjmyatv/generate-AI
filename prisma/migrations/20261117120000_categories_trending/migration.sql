-- Categories become many-to-many, Trending becomes automatic, and history items can be deleted.
--
-- Reverse (by hand): UPDATE "Template" SET "categoryId" = (SELECT "categoryId" FROM "TemplateCategory" tc
--   WHERE tc."templateId" = "Template"."id" ORDER BY tc."categoryId" LIMIT 1) WHERE "categoryId" IS NULL;
--   then DROP TABLE "TemplateCategory", "TrendingSetting"; the columns added below can be dropped, and
--   "Template"."categoryId" set NOT NULL again with its foreign key. The old column is never modified here.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "system" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- The single category stays in the old column (now optional, no longer enforced) so this can be reversed.
ALTER TABLE "Template" DROP CONSTRAINT "Template_categoryId_fkey";
ALTER TABLE "Template" ALTER COLUMN "categoryId" DROP NOT NULL;
ALTER TABLE "Template" ADD COLUMN     "excludeFromTrending" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TemplateCategory" (
    "templateId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "TemplateCategory_pkey" PRIMARY KEY ("templateId","categoryId")
);

-- CreateTable
CREATE TABLE "TrendingSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "windowDays" INTEGER NOT NULL DEFAULT 7,
    "maxItems" INTEGER NOT NULL DEFAULT 12,
    "minGenerations" INTEGER NOT NULL DEFAULT 3,
    "minUsers" INTEGER NOT NULL DEFAULT 2,
    "minTemplates" INTEGER NOT NULL DEFAULT 4,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrendingSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplateCategory_categoryId_idx" ON "TemplateCategory"("categoryId");

-- AddForeignKey
ALTER TABLE "TemplateCategory" ADD CONSTRAINT "TemplateCategory_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateCategory" ADD CONSTRAINT "TemplateCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Each template's single category moves into the join table. Trending is now automatic, so a template that was
-- filed under "trending" by hand does not keep that: it simply has no category until an admin picks one.
INSERT INTO "TemplateCategory" ("templateId", "categoryId")
SELECT "id", "categoryId" FROM "Template" WHERE "categoryId" IS NOT NULL AND "categoryId" <> 'trending';

-- Trending is a system category; category names are Mongolian from now on (English visitors keep the dictionary's).
UPDATE "Category" SET "system" = true, "name" = 'Эрэлттэй' WHERE "id" = 'trending';
UPDATE "Category" SET "name" = 'Бүжиг' WHERE "id" = 'dance';
UPDATE "Category" SET "name" = 'Зурхай' WHERE "id" = 'horoscope';
UPDATE "Category" SET "name" = 'Зураг' WHERE "id" = 'photo';
