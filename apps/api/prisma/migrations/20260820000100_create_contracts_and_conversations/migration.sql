-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'CLOSED', 'BLOCKED');

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL,
    "service_request_id" UUID NOT NULL,
    "accepted_proposal_id" UUID NOT NULL,
    "customer_profile_id" UUID NOT NULL,
    "professional_profile_id" UUID NOT NULL,
    "agreed_amount_in_cents" INTEGER NOT NULL,
    "agreed_duration_value" INTEGER NOT NULL,
    "agreed_duration_unit" "EstimatedDurationUnit" NOT NULL,
    "agreed_message" VARCHAR(2000) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACCEPTED',
    "accepted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancellation_reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "closed_at" TIMESTAMPTZ(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contracts_customer_profile_status_created_at_idx" ON "contracts"("customer_profile_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "contracts_professional_profile_status_created_at_idx" ON "contracts"("professional_profile_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_service_request_id_key" ON "contracts"("service_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_accepted_proposal_id_key" ON "contracts"("accepted_proposal_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_contract_id_key" ON "conversations"("contract_id");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_accepted_proposal_id_fkey" FOREIGN KEY ("accepted_proposal_id") REFERENCES "proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customer_profile_id_fkey" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;