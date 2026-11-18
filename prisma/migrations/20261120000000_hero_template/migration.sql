-- The admin picks which template the home page's hero card shows. Nothing is picked yet, so the home page keeps
-- choosing one automatically until an admin sets it.
ALTER TABLE "Template" ADD COLUMN "heroFeatured" BOOLEAN NOT NULL DEFAULT false;
