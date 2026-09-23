ALTER TABLE "customer_profiles" ADD COLUMN "average_rating" DECIMAL(3,2) NOT NULL DEFAULT 0, ADD COLUMN "review_count" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "customer_reviews" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "customer_profile_id" UUID NOT NULL,
    "professional_profile_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "customer_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_reviews_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);
CREATE UNIQUE INDEX "customer_reviews_contract_id_key" ON "customer_reviews"("contract_id");
CREATE INDEX "customer_reviews_customer_created_at_idx" ON "customer_reviews"("customer_profile_id", "created_at");
ALTER TABLE "customer_reviews" ADD CONSTRAINT "customer_reviews_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_reviews" ADD CONSTRAINT "customer_reviews_customer_profile_id_fkey" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_reviews" ADD CONSTRAINT "customer_reviews_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
