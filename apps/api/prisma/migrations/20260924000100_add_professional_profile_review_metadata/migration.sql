ALTER TABLE "professional_profiles"
ADD COLUMN "review_notes" VARCHAR(1000),
ADD COLUMN "reviewed_by_user_id" UUID,
ADD COLUMN "reviewed_at" TIMESTAMPTZ(3);

CREATE INDEX "professional_profiles_reviewer_idx"
ON "professional_profiles"("reviewed_by_user_id");

ALTER TABLE "professional_profiles"
ADD CONSTRAINT "professional_profiles_reviewed_by_user_id_fkey"
FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
