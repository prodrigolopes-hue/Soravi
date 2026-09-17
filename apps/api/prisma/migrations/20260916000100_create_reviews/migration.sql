CREATE TABLE "reviews" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "customer_profile_id" UUID NOT NULL,
  "professional_profile_id" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reviews_contract_id_key" UNIQUE ("contract_id"),
  CONSTRAINT "reviews_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5),
  CONSTRAINT "reviews_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reviews_customer_profile_id_fkey" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reviews_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "reviews_professional_created_at_idx" ON "reviews"("professional_profile_id", "created_at");
