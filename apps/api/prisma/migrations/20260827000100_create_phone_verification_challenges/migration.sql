-- CreateTable
CREATE TABLE "phone_verification_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "phone_normalized" VARCHAR(32) NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "consumed_at" TIMESTAMPTZ(3),
    "invalidated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_verification_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "phone_verification_challenges_user_created_at_idx"
ON "phone_verification_challenges"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "phone_verification_challenges_user_state_expires_at_idx"
ON "phone_verification_challenges"("user_id", "consumed_at", "invalidated_at", "expires_at");

-- CreateIndex
CREATE INDEX "phone_verification_challenges_expires_at_idx"
ON "phone_verification_challenges"("expires_at");

-- AddForeignKey
ALTER TABLE "phone_verification_challenges"
ADD CONSTRAINT "phone_verification_challenges_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
