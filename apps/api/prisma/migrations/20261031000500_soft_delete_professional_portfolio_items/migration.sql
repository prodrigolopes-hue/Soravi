ALTER TABLE "professional_portfolio_items" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
DROP INDEX "professional_portfolio_items_profile_created_idx";
CREATE INDEX "professional_portfolio_items_profile_created_idx" ON "professional_portfolio_items"("professional_profile_id", "deleted_at", "created_at");
