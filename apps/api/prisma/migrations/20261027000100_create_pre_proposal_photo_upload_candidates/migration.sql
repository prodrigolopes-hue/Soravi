CREATE TYPE "PreProposalPhotoCandidateStatus" AS ENUM ('PENDING', 'PROCESSING');
CREATE TABLE "pre_proposal_response_photo_upload_candidates" (
 "id" UUID NOT NULL, "object_key" VARCHAR(1024) NOT NULL, "status" "PreProposalPhotoCandidateStatus" NOT NULL DEFAULT 'PENDING', "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "attempt_count" INTEGER NOT NULL DEFAULT 0, "lease_expires_at" TIMESTAMPTZ(3), "last_error" VARCHAR(1000), "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "pre_proposal_response_photo_upload_candidates_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "pre_proposal_response_photo_upload_candidates_object_key_key" ON "pre_proposal_response_photo_upload_candidates"("object_key");
CREATE INDEX "pre_proposal_response_photo_upload_candidates_status_next_attempt_at_idx" ON "pre_proposal_response_photo_upload_candidates"("status", "next_attempt_at");
