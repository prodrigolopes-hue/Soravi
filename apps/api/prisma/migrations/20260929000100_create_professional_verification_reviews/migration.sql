CREATE TABLE "professional_verification_reviews" (
  "id" UUID NOT NULL,
  "professional_profile_id" UUID NOT NULL,
  "from_status" "ProfessionalVerificationStatus" NOT NULL,
  "to_status" "ProfessionalVerificationStatus" NOT NULL,
  "review_notes" VARCHAR(1000),
  "reviewed_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "professional_verification_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "professional_verification_reviews_profile_created_at_idx"
ON "professional_verification_reviews"("professional_profile_id", "created_at");

ALTER TABLE "professional_verification_reviews"
ADD CONSTRAINT "professional_verification_reviews_professional_profile_id_fkey"
FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "professional_verification_reviews"
ADD CONSTRAINT "professional_verification_reviews_reviewed_by_user_id_fkey"
FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
