ALTER TYPE "IdentityVerificationEvidenceKind" ADD VALUE IF NOT EXISTS 'SELFIE';

ALTER TABLE "professional_identity_verification_attempts"
ADD COLUMN "requires_selfie" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "identity_verification_evidence_references"
ADD COLUMN "superseded_at" TIMESTAMPTZ(3);

CREATE INDEX "iv_evidence_attempt_kind_active_idx"
ON "identity_verification_evidence_references" ("attempt_id", "kind", "created_at")
WHERE "superseded_at" IS NULL;

CREATE TABLE "identity_selfie_access_audits" (
  "id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "operator_user_id" UUID NOT NULL,
  "action" VARCHAR(64) NOT NULL,
  "accessed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "identity_selfie_access_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "identity_selfie_access_audits_attempt_fkey" FOREIGN KEY ("attempt_id") REFERENCES "professional_identity_verification_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "identity_selfie_access_audits_operator_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "identity_selfie_access_audits_attempt_accessed_at_idx"
ON "identity_selfie_access_audits" ("attempt_id", "accessed_at");

CREATE INDEX "identity_selfie_access_audits_operator_accessed_at_idx"
ON "identity_selfie_access_audits" ("operator_user_id", "accessed_at");
