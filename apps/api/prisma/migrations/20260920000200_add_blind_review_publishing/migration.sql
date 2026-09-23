ALTER TABLE "reviews" ADD COLUMN "published_at" TIMESTAMPTZ(3);
ALTER TABLE "customer_reviews" ADD COLUMN "published_at" TIMESTAMPTZ(3);
