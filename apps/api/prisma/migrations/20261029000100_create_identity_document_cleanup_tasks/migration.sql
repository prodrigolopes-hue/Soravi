CREATE TYPE "IdentityDocumentCleanupStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "identity_document_cleanup_tasks" (
  "id" UUID NOT NULL,
  "object_key" VARCHAR(1024) NOT NULL,
  "status" "IdentityDocumentCleanupStatus" NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(3) NOT NULL,
  "lease_expires_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "identity_document_cleanup_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "identity_document_cleanup_tasks_object_key_key" UNIQUE ("object_key")
);

CREATE INDEX "identity_document_cleanup_tasks_ready_idx"
ON "identity_document_cleanup_tasks" ("status", "next_attempt_at");
