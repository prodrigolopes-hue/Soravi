ALTER TABLE "identity_verification_evidence_references"
  ADD COLUMN "discard_requested_at" TIMESTAMPTZ(3),
  ADD COLUMN "discarded_at" TIMESTAMPTZ(3);

CREATE TABLE "identity_evidence_disposal_suspension_events" (
  "id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "action" VARCHAR(16) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "operator_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "identity_evidence_disposal_suspension_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "identity_evidence_disposal_suspension_events_action_check" CHECK ("action" IN ('APPLIED', 'RELEASED')),
  CONSTRAINT "identity_evidence_disposal_suspension_events_attempt_fkey" FOREIGN KEY ("attempt_id") REFERENCES "professional_identity_verification_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "identity_evidence_disposal_suspension_events_operator_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "identity_disposal_suspension_attempt_created_idx"
  ON "identity_evidence_disposal_suspension_events"("attempt_id", "created_at");
