ALTER TABLE "pre_proposal_conversations"
ADD COLUMN "closed_at" TIMESTAMPTZ(3);

DROP INDEX "pre_proposal_conversations_opportunity_key";
CREATE INDEX "pre_proposal_conversations_opportunity_created_idx"
ON "pre_proposal_conversations"("service_opportunity_id", "created_at");

-- Preserve historical records. Threads that already contain a reply (or more)
-- are immutable under the new one-question/one-response rule.
UPDATE "pre_proposal_conversations" AS conversation
SET "closed_at" = COALESCE(conversation."updated_at", CURRENT_TIMESTAMP)
WHERE conversation."closed_at" IS NULL
  AND (SELECT count(*) FROM "pre_proposal_messages" AS message WHERE message."pre_proposal_conversation_id" = conversation."id") >= 2;

CREATE TABLE "pre_proposal_response_photos" (
  "id" UUID NOT NULL,
  "pre_proposal_message_id" UUID NOT NULL,
  "object_key" VARCHAR(1024) NOT NULL,
  "original_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(127) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "position" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pre_proposal_response_photos_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pre_proposal_response_photos_object_key_key" ON "pre_proposal_response_photos"("object_key");
CREATE UNIQUE INDEX "pre_proposal_response_photos_message_position_key" ON "pre_proposal_response_photos"("pre_proposal_message_id", "position");
ALTER TABLE "pre_proposal_response_photos" ADD CONSTRAINT "pre_proposal_response_photos_message_fkey"
  FOREIGN KEY ("pre_proposal_message_id") REFERENCES "pre_proposal_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
