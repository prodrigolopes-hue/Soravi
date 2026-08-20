-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('ACTIVE', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EstimatedDurationUnit" AS ENUM ('HOUR', 'DAY', 'WEEK', 'MONTH');

-- CreateTable
CREATE TABLE "proposals" (
    "id" UUID NOT NULL,
    "service_request_id" UUID NOT NULL,
    "professional_profile_id" UUID NOT NULL,
    "amount_in_cents" INTEGER NOT NULL,
    "estimated_duration_value" INTEGER NOT NULL,
    "estimated_duration_unit" "EstimatedDurationUnit" NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'ACTIVE',
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMPTZ(3),
    "rejected_at" TIMESTAMPTZ(3),
    "withdrawn_at" TIMESTAMPTZ(3),
    "expired_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proposals_service_request_status_created_at_idx" ON "proposals"("service_request_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "proposals_professional_profile_status_created_at_idx" ON "proposals"("professional_profile_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_service_request_professional_key" ON "proposals"("service_request_id", "professional_profile_id");

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;