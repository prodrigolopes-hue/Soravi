-- CreateTable
CREATE TABLE "service_opportunities" (
    "id" UUID NOT NULL,
    "service_request_id" UUID NOT NULL,
    "professional_profile_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewed_at" TIMESTAMPTZ(3),

    CONSTRAINT "service_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_opportunities_professional_profile_id_idx" ON "service_opportunities"("professional_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_opportunities_service_request_professional_key" ON "service_opportunities"("service_request_id", "professional_profile_id");

-- AddForeignKey
ALTER TABLE "service_opportunities" ADD CONSTRAINT "service_opportunities_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_opportunities" ADD CONSTRAINT "service_opportunities_professional_profile_id_fkey" FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
