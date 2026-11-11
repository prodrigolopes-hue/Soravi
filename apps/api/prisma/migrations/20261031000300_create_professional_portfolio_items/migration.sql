CREATE TABLE "professional_portfolio_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "professional_profile_id" UUID NOT NULL,
  "object_key" VARCHAR(1024) NOT NULL,
  "mime_type" VARCHAR(32) NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "caption" VARCHAR(280),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "professional_portfolio_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "professional_portfolio_items_object_key_key" UNIQUE ("object_key"),
  CONSTRAINT "professional_portfolio_items_professional_profile_id_fkey"
    FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "professional_portfolio_items_profile_created_idx"
  ON "professional_portfolio_items"("professional_profile_id", "created_at");
