-- AlterEnum
ALTER TYPE "PublicCategorySuggestionStatus" ADD VALUE 'APPROVED';
ALTER TYPE "PublicCategorySuggestionStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "public_category_suggestions"
ADD COLUMN "review_notes" VARCHAR(1000),
ADD COLUMN "reviewed_by_user_id" UUID,
ADD COLUMN "reviewed_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE INDEX "public_category_suggestions_reviewer_idx" ON "public_category_suggestions"("reviewed_by_user_id");

-- AddForeignKey
ALTER TABLE "public_category_suggestions"
ADD CONSTRAINT "public_category_suggestions_reviewed_by_user_id_fkey"
FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
