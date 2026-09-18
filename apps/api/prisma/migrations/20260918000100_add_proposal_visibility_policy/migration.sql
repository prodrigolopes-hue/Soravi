ALTER TABLE "service_requests"
  ADD COLUMN "visible_proposal_limit" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "proposals"
  ADD COLUMN "is_visible" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "proposals_service_request_visible_submitted_at_idx"
  ON "proposals"("service_request_id", "is_visible", "submitted_at");
