-- CreateEnum
CREATE TYPE "CategoryRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'MERGED');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "icon" VARCHAR(64),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_requests" (
    "id" UUID NOT NULL,
    "professional_profile_id" UUID NOT NULL,
    "suggested_name" VARCHAR(120) NOT NULL,
    "suggested_name_normalized" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000),
    "status" "CategoryRequestStatus" NOT NULL DEFAULT 'PENDING',
    "review_notes" VARCHAR(1000),
    "resolved_category_id" UUID,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "category_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_active_display_order_idx" ON "categories"("is_active", "display_order");

-- CreateIndex
CREATE INDEX "categories_name_idx" ON "categories"("name");

-- CreateIndex
CREATE INDEX "category_requests_status_created_at_idx" ON "category_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "category_requests_professional_status_idx" ON "category_requests"("professional_profile_id", "status");

-- CreateIndex
CREATE INDEX "category_requests_normalized_name_status_idx" ON "category_requests"("suggested_name_normalized", "status");

-- CreateIndex
CREATE INDEX "category_requests_resolved_category_idx" ON "category_requests"("resolved_category_id");

-- CreateIndex
CREATE INDEX "category_requests_reviewer_idx" ON "category_requests"("reviewed_by_user_id");

-- AddForeignKey
ALTER TABLE "category_requests" ADD CONSTRAINT "category_requests_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_requests" ADD CONSTRAINT "category_requests_resolved_category_id_fkey" FOREIGN KEY ("resolved_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_requests" ADD CONSTRAINT "category_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
