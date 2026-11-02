CREATE TYPE "IdentityEvidenceDisposalTaskStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "identity_verification_evidence_references"
  ALTER COLUMN "reference" DROP NOT NULL,
  ADD COLUMN "discard_started_at" TIMESTAMPTZ(3);

CREATE TABLE "identity_evidence_disposal_tasks" (
  "id" UUID NOT NULL,
  "evidence_id" UUID NOT NULL,
  "object_key" VARCHAR(255) NOT NULL,
  "policy_version" VARCHAR(64) NOT NULL,
  "reason" VARCHAR(64) NOT NULL,
  "eligible_at" TIMESTAMPTZ(3) NOT NULL,
  "status" "IdentityEvidenceDisposalTaskStatus" NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(3) NOT NULL,
  "lease_expires_at" TIMESTAMPTZ(3),
  "irreversible_started_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  "last_error" VARCHAR(64),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "identity_ev_disposal_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "identity_ev_disposal_tasks_evidence_key" UNIQUE ("evidence_id"),
  CONSTRAINT "identity_ev_disposal_tasks_evidence_fkey" FOREIGN KEY ("evidence_id") REFERENCES "identity_verification_evidence_references"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "identity_ev_disposal_tasks_ready_idx"
  ON "identity_evidence_disposal_tasks" ("status", "next_attempt_at");
