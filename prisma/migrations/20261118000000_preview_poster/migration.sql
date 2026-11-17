-- A small still image of a video preview, so template cards do not have to download the video.
-- AlterTable
ALTER TABLE "Template" ADD COLUMN     "previewPosterUrl" TEXT;
