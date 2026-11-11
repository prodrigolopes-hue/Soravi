-- CreateTable
CREATE TABLE "personal_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "cpf_envelope" JSONB NOT NULL,
    "cpf_hmac" VARCHAR(64) NOT NULL,
    "hmac_key_id" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "personal_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personal_identities_user_id_key"
ON "personal_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "personal_identities_cpf_hmac_key"
ON "personal_identities"("cpf_hmac");

-- AddForeignKey
ALTER TABLE "personal_identities"
ADD CONSTRAINT "personal_identities_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
