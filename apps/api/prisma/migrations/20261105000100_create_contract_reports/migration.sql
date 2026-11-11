CREATE TYPE "ContractReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');
CREATE TYPE "ContractReportReason" AS ENUM ('IDENTITY_DIVERGENCE', 'INAPPROPRIATE_CONDUCT', 'OTHER');

CREATE TABLE "contract_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "protocol" VARCHAR(40) NOT NULL,
  "contract_id" UUID NOT NULL,
  "reporter_user_id" UUID NOT NULL,
  "target_user_id" UUID NOT NULL,
  "reason" "ContractReportReason" NOT NULL,
  "description" VARCHAR(1200) NOT NULL,
  "status" "ContractReportStatus" NOT NULL DEFAULT 'OPEN',
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMPTZ(3),
  "resolution" VARCHAR(1200),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "contract_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_reports_protocol_key" UNIQUE ("protocol"),
  CONSTRAINT "contract_reports_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "contract_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "contract_reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "contract_reports_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "contract_report_status_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL,
  "status" "ContractReportStatus" NOT NULL,
  "reason" VARCHAR(1200),
  "actor_user_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_report_status_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contract_report_status_history_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "contract_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "contract_report_status_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "contract_reports_status_created_at_idx" ON "contract_reports"("status", "created_at");
CREATE INDEX "contract_reports_contract_idx" ON "contract_reports"("contract_id");
CREATE INDEX "contract_report_history_report_created_at_idx" ON "contract_report_status_history"("report_id", "created_at");
CREATE UNIQUE INDEX "contract_reports_one_open_per_participant_contract" ON "contract_reports"("contract_id", "reporter_user_id") WHERE "status" IN ('OPEN', 'UNDER_REVIEW');
