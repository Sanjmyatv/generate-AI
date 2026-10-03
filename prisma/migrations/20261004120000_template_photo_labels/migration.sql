-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "photoLabels" TEXT[] DEFAULT ARRAY[]::TEXT[];
