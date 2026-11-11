CREATE TYPE "ProfessionalProfilePhotoTaskKind" AS ENUM (
  'UPLOAD_CANDIDATE',
  'PHOTO_DELETE'
);

ALTER TABLE "professional_profile_photo_deletion_tasks"
ADD COLUMN "kind" "ProfessionalProfilePhotoTaskKind",
ADD COLUMN "association_deadline_at" TIMESTAMPTZ(3),
ADD COLUMN "reconcile_next_at" TIMESTAMPTZ(3),
ADD COLUMN "reconcile_attempt_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reconcile_claimed_at" TIMESTAMPTZ(3),
ADD COLUMN "reconcile_lease_expires_at" TIMESTAMPTZ(3),
ADD COLUMN "reconcile_last_error" VARCHAR(1000);

-- Historical rows can be either a pre-upload candidate or a photo deletion.
-- Treat all of them as candidates: they are already past their original
-- association window and remain eligible for durable reconciliation.
UPDATE "professional_profile_photo_deletion_tasks"
SET
  "kind" = 'UPLOAD_CANDIDATE',
  "association_deadline_at" = "created_at",
  "reconcile_next_at" = CURRENT_TIMESTAMP;

ALTER TABLE "professional_profile_photo_deletion_tasks"
ALTER COLUMN "kind" SET NOT NULL,
ALTER COLUMN "kind" SET DEFAULT 'PHOTO_DELETE',
ADD CONSTRAINT "professional_profile_photo_tasks_reconcile_attempt_count_check"
  CHECK ("reconcile_attempt_count" >= 0),
ADD CONSTRAINT "professional_profile_photo_tasks_candidate_deadline_check"
  CHECK (
    ("kind" = 'UPLOAD_CANDIDATE' AND "association_deadline_at" IS NOT NULL AND "reconcile_next_at" IS NOT NULL)
    OR
    ("kind" = 'PHOTO_DELETE' AND "association_deadline_at" IS NULL AND "reconcile_next_at" IS NULL)
  ),
ADD CONSTRAINT "professional_profile_photo_tasks_reconcile_lease_check"
  CHECK (
    ("reconcile_claimed_at" IS NULL AND "reconcile_lease_expires_at" IS NULL)
    OR
    ("reconcile_claimed_at" IS NOT NULL AND "reconcile_lease_expires_at" IS NOT NULL)
  );

CREATE INDEX "professional_profile_photo_tasks_reconcile_ready_idx"
ON "professional_profile_photo_deletion_tasks"("kind", "reconcile_next_at");

CREATE INDEX "professional_profile_photo_tasks_reconcile_lease_idx"
ON "professional_profile_photo_deletion_tasks"("kind", "reconcile_lease_expires_at");
