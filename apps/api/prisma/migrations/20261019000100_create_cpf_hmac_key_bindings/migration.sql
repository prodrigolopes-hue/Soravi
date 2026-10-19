CREATE TYPE "CpfHmacKeyBindingState" AS ENUM (
  'UNINITIALIZED',
  'BOUND',
  'ADOPTION_REQUIRED'
);

CREATE TABLE "cpf_hmac_key_bindings" (
  "scope" VARCHAR(64) NOT NULL,
  "state" "CpfHmacKeyBindingState" NOT NULL,
  "hmac_key_id" VARCHAR(64),
  "hmac_key_fingerprint" CHAR(64),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "cpf_hmac_key_bindings_pkey" PRIMARY KEY ("scope"),
  CONSTRAINT "cpf_hmac_key_bindings_scope_check"
    CHECK ("scope" = 'personal_identity_cpf'),
  CONSTRAINT "cpf_hmac_key_bindings_state_fields_check"
    CHECK (
      (
        "state" = 'BOUND'
        AND "hmac_key_id" IS NOT NULL
        AND "hmac_key_fingerprint" IS NOT NULL
      )
      OR (
        "state" IN ('UNINITIALIZED', 'ADOPTION_REQUIRED')
        AND "hmac_key_id" IS NULL
        AND "hmac_key_fingerprint" IS NULL
      )
    ),
  CONSTRAINT "cpf_hmac_key_bindings_hmac_key_id_check"
    CHECK (
      "hmac_key_id" IS NULL
      OR "hmac_key_id" ~ '^[A-Za-z0-9._-]{1,64}$'
    ),
  CONSTRAINT "cpf_hmac_key_bindings_hmac_key_fingerprint_check"
    CHECK (
      "hmac_key_fingerprint" IS NULL
      OR "hmac_key_fingerprint" ~ '^[0-9a-f]{64}$'
    )
);

INSERT INTO "cpf_hmac_key_bindings" (
  "scope",
  "state",
  "hmac_key_id",
  "hmac_key_fingerprint",
  "updated_at"
)
SELECT
  'personal_identity_cpf',
  CASE
    WHEN EXISTS (SELECT 1 FROM "personal_identities")
      THEN 'ADOPTION_REQUIRED'::"CpfHmacKeyBindingState"
    ELSE 'UNINITIALIZED'::"CpfHmacKeyBindingState"
  END,
  NULL,
  NULL,
  CURRENT_TIMESTAMP;
