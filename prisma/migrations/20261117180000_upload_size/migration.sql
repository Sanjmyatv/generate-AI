-- The size of an uploaded photo, so the server can work out an image's Auto ratio from it.
-- AlterTable
ALTER TABLE "Upload" ADD COLUMN     "height" INTEGER,
ADD COLUMN     "width" INTEGER;
