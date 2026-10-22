CREATE TYPE "ProfessionalProfilePhotoDeletionStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED'
);

CREATE TABLE "professional_profile_photos" (
  "professional_profile_id" UUID NOT NULL,
  "object_key" VARCHAR(1024) NOT NULL,
  "mime_type" VARCHAR(32) NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "professional_profile_photos_pkey" PRIMARY KEY ("professional_profile_id"),
  CONSTRAINT "professional_profile_photos_mime_type_check"
    CHECK ("mime_type" = 'image/webp'),
  CONSTRAINT "professional_profile_photos_dimensions_check"
    CHECK ("width" > 0 AND "height" > 0)
);

CREATE TABLE "professional_profile_photo_deletion_tasks" (
  "id" UUID NOT NULL,
  "object_key" VARCHAR(1024) NOT NULL,
  "status" "ProfessionalProfilePhotoDeletionStatus" NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimed_at" TIMESTAMPTZ(3),
  "lease_expires_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  "last_error" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "professional_profile_photo_deletion_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "professional_profile_photo_deletion_tasks_attempt_count_check"
    CHECK ("attempt_count" >= 0),
  CONSTRAINT "professional_profile_photo_deletion_tasks_state_check"
    CHECK (
      (
        "status" = 'PENDING'
        AND "completed_at" IS NULL
        AND "claimed_at" IS NULL
        AND "lease_expires_at" IS NULL
      )
      OR (
        "status" = 'PROCESSING'
        AND "completed_at" IS NULL
        AND "claimed_at" IS NOT NULL
        AND "lease_expires_at" IS NOT NULL
      )
      OR (
        "status" IN ('COMPLETED', 'FAILED')
        AND "completed_at" IS NOT NULL
        AND "claimed_at" IS NULL
        AND "lease_expires_at" IS NULL
      )
    )
);

CREATE UNIQUE INDEX "professional_profile_photos_object_key_key"
ON "professional_profile_photos"("object_key");

CREATE UNIQUE INDEX "professional_profile_photo_deletion_tasks_object_key_key"
ON "professional_profile_photo_deletion_tasks"("object_key");

CREATE INDEX "professional_profile_photo_deletion_tasks_ready_idx"
ON "professional_profile_photo_deletion_tasks"("status", "next_attempt_at");

CREATE INDEX "professional_profile_photo_deletion_tasks_lease_idx"
ON "professional_profile_photo_deletion_tasks"("status", "lease_expires_at");

ALTER TABLE "professional_profile_photos"
ADD CONSTRAINT "professional_profile_photos_professional_profile_id_fkey"
FOREIGN KEY ("professional_profile_id") REFERENCES "professional_profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
