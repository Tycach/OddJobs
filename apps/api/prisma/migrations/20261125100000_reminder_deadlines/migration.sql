BEGIN;

ALTER TABLE "jobs" ADD COLUMN "completion_submitted_at" TIMESTAMPTZ(3);
ALTER TABLE "job_payments" ADD COLUMN "platform_fee_due_at" TIMESTAMPTZ(3);

UPDATE "jobs"
SET "completion_submitted_at" = "updated_at"
WHERE "status" = 'COMPLETION_PENDING';

UPDATE "job_payments"
SET "platform_fee_due_at" = "confirmed_at" + INTERVAL '48 hours'
WHERE "status" = 'PAID' AND "confirmed_at" IS NOT NULL;

CREATE INDEX "jobs_status_completion_submitted_at_idx"
  ON "jobs"("status", "completion_submitted_at");
CREATE INDEX "job_payments_platform_fee_status_due_at_idx"
  ON "job_payments"("platform_fee_status", "platform_fee_due_at");

COMMIT;
