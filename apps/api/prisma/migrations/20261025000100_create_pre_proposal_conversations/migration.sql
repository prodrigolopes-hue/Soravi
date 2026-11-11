CREATE TABLE "pre_proposal_conversations" (
  "id" UUID NOT NULL,
  "service_opportunity_id" UUID NOT NULL,
  "customer_profile_id" UUID NOT NULL,
  "professional_profile_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "pre_proposal_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pre_proposal_messages" (
  "id" UUID NOT NULL,
  "pre_proposal_conversation_id" UUID NOT NULL,
  "sender_user_id" UUID NOT NULL,
  "content" VARCHAR(4000) NOT NULL,
  "sent_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pre_proposal_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pre_proposal_conversations_opportunity_key" ON "pre_proposal_conversations"("service_opportunity_id");
CREATE INDEX "pre_proposal_conversations_customer_updated_idx" ON "pre_proposal_conversations"("customer_profile_id", "updated_at");
CREATE INDEX "pre_proposal_conversations_professional_updated_idx" ON "pre_proposal_conversations"("professional_profile_id", "updated_at");
CREATE INDEX "pre_proposal_messages_conversation_sent_idx" ON "pre_proposal_messages"("pre_proposal_conversation_id", "sent_at", "id");
CREATE INDEX "pre_proposal_messages_sender_sent_idx" ON "pre_proposal_messages"("sender_user_id", "sent_at");

ALTER TABLE "pre_proposal_conversations" ADD CONSTRAINT "pre_proposal_conversations_opportunity_fkey" FOREIGN KEY ("service_opportunity_id") REFERENCES "service_opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pre_proposal_conversations" ADD CONSTRAINT "pre_proposal_conversations_customer_fkey" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pre_proposal_conversations" ADD CONSTRAINT "pre_proposal_conversations_professional_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pre_proposal_messages" ADD CONSTRAINT "pre_proposal_messages_conversation_fkey" FOREIGN KEY ("pre_proposal_conversation_id") REFERENCES "pre_proposal_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pre_proposal_messages" ADD CONSTRAINT "pre_proposal_messages_sender_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
