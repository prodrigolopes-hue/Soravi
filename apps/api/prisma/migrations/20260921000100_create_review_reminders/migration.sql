ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REVIEW_REMINDER_D1';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REVIEW_REMINDER_D4';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REVIEW_REMINDER_D6';

CREATE TYPE "ReviewReminderType" AS ENUM ('D1', 'D4', 'D6');

CREATE TABLE "review_reminders" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reminder_type" "ReviewReminderType" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "review_reminders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "review_reminders_contract_user_type_key" ON "review_reminders"("contract_id", "user_id", "reminder_type");
CREATE INDEX "review_reminders_contract_idx" ON "review_reminders"("contract_id");
CREATE INDEX "review_reminders_user_idx" ON "review_reminders"("user_id");
ALTER TABLE "review_reminders" ADD CONSTRAINT "review_reminders_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_reminders" ADD CONSTRAINT "review_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
