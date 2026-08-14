-- CreateEnum
CREATE TYPE "PublicCategorySuggestionStatus" AS ENUM ('PENDING');

-- CreateTable
CREATE TABLE "public_category_suggestions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(32),
    "suggested_name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000),
    "status" "PublicCategorySuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "privacy_notice_accepted_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "public_category_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "public_category_suggestions_status_created_at_idx" ON "public_category_suggestions"("status", "created_at");
