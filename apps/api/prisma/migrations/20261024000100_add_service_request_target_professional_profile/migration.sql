ALTER TABLE "service_requests"
ADD COLUMN "target_professional_profile_id" UUID;

ALTER TABLE "service_requests"
ADD CONSTRAINT "service_requests_target_professional_profile_id_fkey"
FOREIGN KEY ("target_professional_profile_id")
REFERENCES "professional_profiles"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

CREATE INDEX "service_requests_target_professional_status_idx"
ON "service_requests"("target_professional_profile_id", "status");
