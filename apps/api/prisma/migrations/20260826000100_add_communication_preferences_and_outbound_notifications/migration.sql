-- CreateEnum
CREATE TYPE "CommunicationChannel" AS ENUM ('WHATSAPP');

-- CreateEnum
CREATE TYPE "OutboundNotificationStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "communication_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "consent_version" VARCHAR(32),
    "consent_purpose" VARCHAR(160),
    "opted_in_at" TIMESTAMPTZ(3),
    "opted_out_at" TIMESTAMPTZ(3),
    "consent_source" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "communication_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_notifications" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "CommunicationChannel" NOT NULL,
    "event_type" "NotificationType" NOT NULL,
    "status" "OutboundNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3),
    "sent_at" TIMESTAMPTZ(3),
    "last_error_code" VARCHAR(64),
    "provider_message_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "outbound_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "communication_preferences_user_channel_key" ON "communication_preferences"("user_id", "channel");

-- CreateIndex
CREATE INDEX "communication_preferences_channel_enabled_idx" ON "communication_preferences"("channel", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_notifications_notification_channel_key" ON "outbound_notifications"("notification_id", "channel");

-- CreateIndex
CREATE INDEX "outbound_notifications_status_next_attempt_at_idx" ON "outbound_notifications"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "outbound_notifications_user_channel_created_at_idx" ON "outbound_notifications"("user_id", "channel", "created_at");

-- AddForeignKey
ALTER TABLE "communication_preferences" ADD CONSTRAINT "communication_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_notifications" ADD CONSTRAINT "outbound_notifications_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_notifications" ADD CONSTRAINT "outbound_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
