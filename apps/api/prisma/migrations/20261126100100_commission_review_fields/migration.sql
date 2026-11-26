ALTER TABLE "job_payments"
  ADD COLUMN "platform_fee_correction_reason" VARCHAR(1000),
  ADD COLUMN "platform_fee_reminder_cycle" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "job_payments"
  ADD CONSTRAINT "job_payments_platform_fee_correction_check"
  CHECK (
    "platform_fee_status" <> 'NEEDS_CORRECTION'
    OR (
      "platform_fee_correction_reason" IS NOT NULL
      AND "platform_fee_reported_by_user_id" IS NOT NULL
      AND "platform_fee_reported_at" IS NOT NULL
      AND "platform_fee_payment_reference" IS NOT NULL
    )
  );
