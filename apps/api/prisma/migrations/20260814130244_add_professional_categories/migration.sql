-- CreateTable
CREATE TABLE "professional_categories" (
    "id" UUID NOT NULL,
    "professional_profile_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "professional_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "professional_categories_professional_profile_id_idx" ON "professional_categories"("professional_profile_id");

-- CreateIndex
CREATE INDEX "professional_categories_category_id_idx" ON "professional_categories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "professional_categories_professional_profile_id_category_id_key" ON "professional_categories"("professional_profile_id", "category_id");

-- AddForeignKey
ALTER TABLE "professional_categories" ADD CONSTRAINT "professional_categories_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_categories" ADD CONSTRAINT "professional_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
