-- AddColumns
ALTER TABLE "service_requests"
ADD COLUMN "editable_until" TIMESTAMPTZ(3),
ADD COLUMN "opportunities_dispatched_at" TIMESTAMPTZ(3);

-- BackfillEditableUntil
UPDATE "service_requests"
SET "editable_until" = "created_at" + INTERVAL '10 minutes';

-- MakeEditableUntilRequired
ALTER TABLE "service_requests"
ALTER COLUMN "editable_until" SET NOT NULL;

-- ChangeStatusDefault
ALTER TABLE "service_requests"
ALTER COLUMN "status" SET DEFAULT 'OPEN';