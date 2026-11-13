-- Additive lookup support for requests created during professional registration.
-- Existing public_category_suggestions stay independent by design.
-- This deliberately is not unique: legacy records may already contain pending
-- duplicates. New writes are serialized by the locked user transaction.
CREATE INDEX "category_requests_pending_profile_normalized_name_idx"
ON "category_requests" ("professional_profile_id", "suggested_name_normalized")
WHERE "status" = 'PENDING';
