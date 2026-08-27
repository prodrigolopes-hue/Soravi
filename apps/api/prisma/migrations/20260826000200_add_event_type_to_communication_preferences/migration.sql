-- Preferências legadas eram genéricas por canal e não comprovam consentimento
-- para eventos específicos. Removê-las evita criar opt-ins implícitos.
DELETE FROM "communication_preferences";

-- AlterTable
ALTER TABLE "communication_preferences"
ADD COLUMN "event_type" "NotificationType" NOT NULL;

-- DropIndex
DROP INDEX "communication_preferences_user_channel_key";

-- DropIndex
DROP INDEX "communication_preferences_channel_enabled_idx";

-- CreateIndex
CREATE UNIQUE INDEX "communication_preferences_user_channel_event_type_key"
ON "communication_preferences"("user_id", "channel", "event_type");

-- CreateIndex
CREATE INDEX "communication_preferences_user_channel_event_enabled_idx"
ON "communication_preferences"("user_id", "channel", "event_type", "enabled");
