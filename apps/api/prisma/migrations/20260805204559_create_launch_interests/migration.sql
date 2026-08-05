-- CreateEnum
CREATE TYPE "LaunchInterestType" AS ENUM ('CUSTOMER', 'PROFESSIONAL', 'BOTH');

-- CreateEnum
CREATE TYPE "LaunchInterestSource" AS ENUM ('HOME', 'INSTAGRAM', 'WHATSAPP', 'CAMPAIGN', 'REFERRAL', 'OTHER');

-- CreateTable
CREATE TABLE "launch_interests" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "email_normalized" VARCHAR(254) NOT NULL,
    "phone" VARCHAR(32),
    "phone_normalized" VARCHAR(32),
    "audienceType" "LaunchInterestType" NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "state" VARCHAR(2),
    "service_interest" VARCHAR(500),
    "professional_category_interest" VARCHAR(500),
    "source" "LaunchInterestSource" NOT NULL DEFAULT 'HOME',
    "privacy_notice_accepted_at" TIMESTAMPTZ(3) NOT NULL,
    "marketing_consent_at" TIMESTAMPTZ(3),
    "email_confirmed_at" TIMESTAMPTZ(3),
    "unsubscribed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "launch_interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "launch_interests_email_normalized_key" ON "launch_interests"("email_normalized");

-- CreateIndex
CREATE INDEX "launch_interests_audience_type_created_at_idx" ON "launch_interests"("audienceType", "created_at");

-- CreateIndex
CREATE INDEX "launch_interests_city_state_idx" ON "launch_interests"("city", "state");

-- CreateIndex
CREATE INDEX "launch_interests_source_created_at_idx" ON "launch_interests"("source", "created_at");

-- CreateIndex
CREATE INDEX "launch_interests_email_confirmed_at_idx" ON "launch_interests"("email_confirmed_at");

-- CreateIndex
CREATE INDEX "launch_interests_unsubscribed_at_idx" ON "launch_interests"("unsubscribed_at");
