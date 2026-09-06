-- CreateTable
CREATE TABLE "auth_refresh_token_history" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "rotated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "replayed_at" TIMESTAMPTZ(3),

    CONSTRAINT "auth_refresh_token_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_refresh_token_history_token_hash_key"
ON "auth_refresh_token_history"("token_hash");

-- CreateIndex
CREATE INDEX "auth_refresh_token_history_session_rotated_at_idx"
ON "auth_refresh_token_history"("session_id", "rotated_at");

-- CreateIndex
CREATE INDEX "auth_refresh_token_history_expires_at_idx"
ON "auth_refresh_token_history"("expires_at");

-- AddForeignKey
ALTER TABLE "auth_refresh_token_history"
ADD CONSTRAINT "auth_refresh_token_history_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
