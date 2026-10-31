CREATE TABLE "service_request_public_code_counters" (
  "year" INTEGER NOT NULL,
  "last_sequence" INTEGER NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_request_public_code_counters_pkey" PRIMARY KEY ("year")
);

ALTER TABLE "service_requests" ADD COLUMN "public_code" VARCHAR(32);

WITH numbered AS (
  SELECT
    "id",
    EXTRACT(YEAR FROM "created_at" AT TIME ZONE 'America/Sao_Paulo')::INTEGER AS year,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM "created_at" AT TIME ZONE 'America/Sao_Paulo')::INTEGER
      ORDER BY "created_at" ASC, "id" ASC
    )::INTEGER AS sequence
  FROM "service_requests"
)
UPDATE "service_requests" AS request
SET "public_code" = 'SO' || numbered.year::TEXT || LPAD(numbered.sequence::TEXT, GREATEST(3, LENGTH(numbered.sequence::TEXT)), '0')
FROM numbered
WHERE request."id" = numbered."id";

ALTER TABLE "service_requests" ALTER COLUMN "public_code" SET NOT NULL;
CREATE UNIQUE INDEX "service_requests_public_code_key" ON "service_requests"("public_code");

INSERT INTO "service_request_public_code_counters" ("year", "last_sequence")
SELECT
  EXTRACT(YEAR FROM "created_at" AT TIME ZONE 'America/Sao_Paulo')::INTEGER,
  COUNT(*)::INTEGER
FROM "service_requests"
GROUP BY EXTRACT(YEAR FROM "created_at" AT TIME ZONE 'America/Sao_Paulo')::INTEGER;
