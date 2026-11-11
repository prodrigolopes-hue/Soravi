CREATE TYPE "ProfessionalPortfolioModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE "professional_portfolio_items" ADD COLUMN "moderation_status" "ProfessionalPortfolioModerationStatus" NOT NULL DEFAULT 'PENDING', ADD COLUMN "moderation_version" INTEGER NOT NULL DEFAULT 1, ADD COLUMN "rejection_reason_code" VARCHAR(64);
CREATE TABLE "professional_portfolio_moderation_decisions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "portfolio_item_id" UUID NOT NULL, "operator_user_id" UUID NOT NULL,
  "result" "ProfessionalPortfolioModerationStatus" NOT NULL, "reason_code" VARCHAR(64), "content_version" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "professional_portfolio_moderation_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "professional_portfolio_moderation_decisions_portfolio_item_id_fkey" FOREIGN KEY ("portfolio_item_id") REFERENCES "professional_portfolio_items"("id") ON DELETE CASCADE,
  CONSTRAINT "professional_portfolio_moderation_decisions_operator_user_id_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE INDEX "professional_portfolio_moderation_decisions_portfolio_item_id_created_at_idx" ON "professional_portfolio_moderation_decisions"("portfolio_item_id", "created_at");
