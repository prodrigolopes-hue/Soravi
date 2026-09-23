UPDATE "reviews"
SET "published_at" = "created_at"
WHERE "published_at" IS NULL;

UPDATE "customer_reviews"
SET "published_at" = "created_at"
WHERE "published_at" IS NULL;
