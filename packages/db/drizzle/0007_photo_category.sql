ALTER TABLE "photos" ADD COLUMN IF NOT EXISTS "category" text;--> statement-breakpoint
-- Backfill: existing harvested rows stored the classification in zone_type. Copy it
-- into the new category column so grouping/filtering keeps working. zone_type is now
-- reserved for the assigned page-zone slot (set by the assign endpoint).
UPDATE "photos" SET "category" = "zone_type" WHERE "category" IS NULL AND "zone_type" IS NOT NULL;
