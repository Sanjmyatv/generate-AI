-- The admin picks which template the home page's Trending section shows. Nothing is picked yet, so the section shows
-- the most-used template of the moment until an admin sets one.
ALTER TABLE "Template" ADD COLUMN "trendingFeatured" BOOLEAN NOT NULL DEFAULT false;
