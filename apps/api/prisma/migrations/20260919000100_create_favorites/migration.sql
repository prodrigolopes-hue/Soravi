CREATE TABLE "favorites" (
  "id" UUID NOT NULL,
  "customer_profile_id" UUID NOT NULL,
  "professional_profile_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "favorites_customer_profile_professional_profile_key"
  ON "favorites"("customer_profile_id", "professional_profile_id");

CREATE INDEX "favorites_customer_profile_created_at_idx"
  ON "favorites"("customer_profile_id", "created_at");

ALTER TABLE "favorites"
  ADD CONSTRAINT "favorites_customer_profile_id_fkey"
  FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "favorites"
  ADD CONSTRAINT "favorites_professional_profile_id_fkey"
  FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
