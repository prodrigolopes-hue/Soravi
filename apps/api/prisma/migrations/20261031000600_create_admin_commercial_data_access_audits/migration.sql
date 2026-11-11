CREATE TABLE "admin_commercial_data_access_audits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "service_request_id" UUID NOT NULL,
  "operator_user_id" UUID NOT NULL,
  "action" VARCHAR(64) NOT NULL,
  "accessed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_commercial_data_access_audits_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "admin_commercial_data_access_audits"
  ADD CONSTRAINT "admin_commercial_data_access_audits_service_request_id_fkey"
  FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "admin_commercial_data_access_audits"
  ADD CONSTRAINT "admin_commercial_data_access_audits_operator_user_id_fkey"
  FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "admin_commercial_data_access_audits_request_accessed_at_idx"
  ON "admin_commercial_data_access_audits"("service_request_id", "accessed_at");

CREATE INDEX "admin_commercial_data_access_audits_operator_accessed_at_idx"
  ON "admin_commercial_data_access_audits"("operator_user_id", "accessed_at");
