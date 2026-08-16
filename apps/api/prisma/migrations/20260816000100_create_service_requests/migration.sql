-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('DRAFT', 'OPEN', 'RECEIVING_PROPOSALS', 'IN_NEGOTIATION', 'HIRED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "service_requests" (
    "id" UUID NOT NULL,
    "customer_profile_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000),
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "country" VARCHAR(2) NOT NULL,
    "state" VARCHAR(2) NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "neighborhood" VARCHAR(120) NOT NULL,
    "postal_code" VARCHAR(16) NOT NULL,
    "address_line" VARCHAR(255) NOT NULL,
    "address_number" VARCHAR(32) NOT NULL,
    "address_complement" VARCHAR(255),
    "published_at" TIMESTAMPTZ(3),
    "hired_at" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancellation_reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_requests_customer_status_created_at_idx" ON "service_requests"("customer_profile_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "service_requests_category_status_created_at_idx" ON "service_requests"("category_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "service_requests_status_created_at_idx" ON "service_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_customer_profile_id_fkey" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
