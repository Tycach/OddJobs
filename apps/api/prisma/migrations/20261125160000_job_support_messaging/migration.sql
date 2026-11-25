BEGIN;

CREATE TYPE "support_category" AS ENUM ('GENERAL', 'PAYMENT', 'WORK_REVIEW', 'SAFETY', 'ACCOUNT', 'OTHER');
CREATE TYPE "support_case_status" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED');
CREATE SEQUENCE "support_case_reference_seq" START WITH 1 INCREMENT BY 1 NO CYCLE;

CREATE TABLE "support_cases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "case_reference" VARCHAR(12) NOT NULL DEFAULT ('SUP-' || lpad(nextval('support_case_reference_seq'::regclass)::text, 8, '0')),
  "job_id" UUID NOT NULL,
  "requester_id" UUID NOT NULL,
  "requester_role" "app_role" NOT NULL,
  "category" "support_category" NOT NULL,
  "subject" VARCHAR(160) NOT NULL,
  "status" "support_case_status" NOT NULL DEFAULT 'OPEN',
  "assigned_admin_id" UUID,
  "resolved_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_cases_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_cases_case_reference_key" UNIQUE ("case_reference"),
  CONSTRAINT "support_cases_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "support_cases_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "support_cases_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "support_cases_requester_id_updated_at_idx" ON "support_cases"("requester_id", "updated_at");
CREATE INDEX "support_cases_status_updated_at_idx" ON "support_cases"("status", "updated_at");
CREATE INDEX "support_cases_job_id_created_at_idx" ON "support_cases"("job_id", "created_at");

CREATE TABLE "support_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "case_id" UUID NOT NULL,
  "sender_id" UUID NOT NULL,
  "sender_role" "app_role" NOT NULL,
  "body" VARCHAR(5000) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_messages_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "support_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "support_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "support_messages_case_id_created_at_idx" ON "support_messages"("case_id", "created_at");

COMMIT;
