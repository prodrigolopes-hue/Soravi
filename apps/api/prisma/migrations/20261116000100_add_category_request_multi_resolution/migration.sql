-- A category request may resolve to more than one official category. Keep the
-- legacy resolved_category_id populated for backwards-compatible consumers.
CREATE TABLE "category_request_resolved_categories" (
  "category_request_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "category_request_resolved_categories_pkey" PRIMARY KEY ("category_request_id", "category_id"),
  CONSTRAINT "category_request_resolved_categories_category_request_id_fkey"
    FOREIGN KEY ("category_request_id") REFERENCES "category_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "category_request_resolved_categories_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "category_request_resolved_categories_category_id_idx"
ON "category_request_resolved_categories" ("category_id");

-- Preserve every existing one-category decision in the new historical relation.
INSERT INTO "category_request_resolved_categories" ("category_request_id", "category_id")
SELECT "id", "resolved_category_id"
FROM "category_requests"
WHERE "resolved_category_id" IS NOT NULL
ON CONFLICT DO NOTHING;
