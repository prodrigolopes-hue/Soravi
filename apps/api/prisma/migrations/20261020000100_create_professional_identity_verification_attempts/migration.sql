CREATE TYPE "ProfessionalIdentityVerificationAttemptStatus" AS ENUM (
  'AWAITING_EVIDENCE',
  'UNDER_REVIEW',
  'CLOSED',
  'CANCELLED'
);

CREATE TYPE "IdentityVerificationResult" AS ENUM (
  'PENDING',
  'CONFIRMED',
  'NOT_CONFIRMED',
  'INCONCLUSIVE'
);

CREATE TYPE "IdentityVerificationDecisionSource" AS ENUM (
  'MANUAL',
  'PROVIDER'
);

CREATE TYPE "IdentityVerificationEvidenceKind" AS ENUM (
  'DOCUMENT',
  'OWNERSHIP',
  'OTHER'
);

CREATE TABLE "professional_identity_verification_attempts" (
  "id" UUID NOT NULL,
  "professional_profile_id" UUID NOT NULL,
  "personal_identity_id" UUID NOT NULL,
  "status" "ProfessionalIdentityVerificationAttemptStatus" NOT NULL DEFAULT 'AWAITING_EVIDENCE',
  "result" "IdentityVerificationResult" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMPTZ(3),

  CONSTRAINT "professional_identity_verification_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "professional_identity_verification_attempts_state_check"
    CHECK (
      (
        "status" IN ('AWAITING_EVIDENCE', 'UNDER_REVIEW')
        AND "result" = 'PENDING'
        AND "closed_at" IS NULL
      )
      OR (
        "status" = 'CLOSED'
        AND "result" IN ('CONFIRMED', 'NOT_CONFIRMED', 'INCONCLUSIVE')
        AND "closed_at" IS NOT NULL
      )
      OR (
        "status" = 'CANCELLED'
        AND "result" = 'PENDING'
        AND "closed_at" IS NOT NULL
      )
    )
);

CREATE TABLE "identity_verification_decisions" (
  "id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "source" "IdentityVerificationDecisionSource" NOT NULL,
  "result" "IdentityVerificationResult" NOT NULL,
  "reason_code" VARCHAR(64) NOT NULL,
  "criteria_version" VARCHAR(64) NOT NULL,
  "operator_user_id" UUID,
  "provider_reference" VARCHAR(255),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "identity_verification_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "identity_verification_decisions_result_check"
    CHECK ("result" IN ('CONFIRMED', 'NOT_CONFIRMED', 'INCONCLUSIVE')),
  CONSTRAINT "identity_verification_decisions_source_actor_reference_check"
    CHECK (
      (
        "source" = 'MANUAL'
        AND "operator_user_id" IS NOT NULL
        AND "provider_reference" IS NULL
      )
      OR (
        "source" = 'PROVIDER'
        AND "operator_user_id" IS NULL
        AND "provider_reference" IS NOT NULL
      )
    )
);

CREATE TABLE "identity_verification_evidence_references" (
  "id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "kind" "IdentityVerificationEvidenceKind" NOT NULL,
  "reference" VARCHAR(255) NOT NULL,
  "expires_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "identity_verification_evidence_references_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "piv_attempts_one_active_profile_key"
ON "professional_identity_verification_attempts"("professional_profile_id")
WHERE "status" IN ('AWAITING_EVIDENCE', 'UNDER_REVIEW');

CREATE INDEX "piv_attempts_profile_created_idx"
ON "professional_identity_verification_attempts"("professional_profile_id", "created_at");

CREATE INDEX "piv_attempts_identity_created_idx"
ON "professional_identity_verification_attempts"("personal_identity_id", "created_at");

CREATE INDEX "identity_verification_decisions_attempt_created_at_idx"
ON "identity_verification_decisions"("attempt_id", "created_at");

CREATE INDEX "identity_verification_decisions_operator_idx"
ON "identity_verification_decisions"("operator_user_id");

CREATE INDEX "iv_evidence_attempt_created_idx"
ON "identity_verification_evidence_references"("attempt_id", "created_at");

ALTER TABLE "professional_identity_verification_attempts"
ADD CONSTRAINT "piv_attempts_professional_profile_fkey"
FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "professional_identity_verification_attempts"
ADD CONSTRAINT "piv_attempts_personal_identity_fkey"
FOREIGN KEY ("personal_identity_id") REFERENCES "personal_identities"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "identity_verification_decisions"
ADD CONSTRAINT "identity_verification_decisions_attempt_id_fkey"
FOREIGN KEY ("attempt_id") REFERENCES "professional_identity_verification_attempts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "identity_verification_decisions"
ADD CONSTRAINT "identity_verification_decisions_operator_user_id_fkey"
FOREIGN KEY ("operator_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "identity_verification_evidence_references"
ADD CONSTRAINT "identity_verification_evidence_references_attempt_id_fkey"
FOREIGN KEY ("attempt_id") REFERENCES "professional_identity_verification_attempts"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
