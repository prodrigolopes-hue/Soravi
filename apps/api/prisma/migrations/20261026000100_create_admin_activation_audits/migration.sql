-- CreateTable
CREATE TABLE "admin_activation_audits" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "previous_status" "UserStatus" NOT NULL,
    "new_status" "UserStatus" NOT NULL,
    "justification" VARCHAR(1000) NOT NULL,
    "activated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "execution_id" UUID NOT NULL,

    CONSTRAINT "admin_activation_audits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_activation_audits_initial_transition_check"
      CHECK (
        "action" = 'INITIAL_ADMIN_ACTIVATED'
        AND "previous_status" = 'PENDING'
        AND "new_status" = 'ACTIVE'
      )
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_activation_audits_user_id_key"
ON "admin_activation_audits"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_activation_audits_execution_id_key"
ON "admin_activation_audits"("execution_id");

-- CreateIndex
CREATE INDEX "admin_activation_audits_activated_at_idx"
ON "admin_activation_audits"("activated_at");

-- AddForeignKey
ALTER TABLE "admin_activation_audits"
ADD CONSTRAINT "admin_activation_audits_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
