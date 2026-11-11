CREATE TABLE "identity_cpf_access_audits" (
  "id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "operator_user_id" UUID NOT NULL,
  "action" VARCHAR(64) NOT NULL,
  "accessed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "identity_cpf_access_audits_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "identity_cpf_access_audits" ADD CONSTRAINT "identity_cpf_access_audits_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "professional_identity_verification_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "identity_cpf_access_audits" ADD CONSTRAINT "identity_cpf_access_audits_operator_user_id_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "identity_cpf_access_audits_attempt_accessed_at_idx" ON "identity_cpf_access_audits"("attempt_id", "accessed_at");
CREATE INDEX "identity_cpf_access_audits_operator_accessed_at_idx" ON "identity_cpf_access_audits"("operator_user_id", "accessed_at");
