-- The Trending section now shows several templates, in the order the admin added them. A template is in it while
-- "trendingFeaturedAt" is set; the one already chosen with the old on/off flag stays in.
ALTER TABLE "Template" ADD COLUMN "trendingFeaturedAt" TIMESTAMP(3);
UPDATE "Template" SET "trendingFeaturedAt" = CURRENT_TIMESTAMP WHERE "trendingFeatured" = true;
ALTER TABLE "Template" DROP COLUMN "trendingFeatured";
