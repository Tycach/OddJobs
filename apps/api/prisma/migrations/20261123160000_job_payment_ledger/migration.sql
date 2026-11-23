BEGIN;

CREATE TYPE "job_payment_status" AS ENUM ('AWAITING_PAYMENT', 'REPORTED', 'PAID', 'DISPUTED', 'REFUNDED');
CREATE TYPE "job_payment_method" AS ENUM ('CASH', 'MANUAL_TRANSFER');
CREATE TYPE "platform_fee_status" AS ENUM ('DUE', 'REPORTED', 'RECEIVED', 'DISPUTED');
CREATE SEQUENCE "job_payment_reference_seq" START WITH 1 INCREMENT BY 1 NO CYCLE;

ALTER TABLE "provider_profiles"
  ADD COLUMN "payout_hold_at" TIMESTAMPTZ(3),
  ADD COLUMN "payout_hold_reason" VARCHAR(1000),
  ADD COLUMN "payout_hold_by_user_id" UUID;

CREATE TABLE "job_payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_reference" VARCHAR(13) NOT NULL DEFAULT ('PAY-' || lpad(nextval('job_payment_reference_seq'::regclass)::text, 9, '0')),
  "job_id" UUID NOT NULL,
  "quote_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "provider_id" UUID NOT NULL,
  "gross_amount_minor" BIGINT NOT NULL,
  "commission_basis_points" INTEGER NOT NULL,
  "commission_amount_minor" BIGINT NOT NULL,
  "provider_amount_minor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'KES',
  "method" "job_payment_method",
  "status" "job_payment_status" NOT NULL DEFAULT 'AWAITING_PAYMENT',
  "reported_by_user_id" UUID,
  "reported_at" TIMESTAMPTZ(3),
  "confirmed_by_user_id" UUID,
  "confirmed_at" TIMESTAMPTZ(3),
  "platform_fee_status" "platform_fee_status" NOT NULL DEFAULT 'DUE',
  "platform_fee_reported_by_user_id" UUID,
  "platform_fee_reported_at" TIMESTAMPTZ(3),
  "platform_fee_payment_reference" VARCHAR(120),
  "platform_fee_received_at" TIMESTAMPTZ(3),
  "platform_fee_receipt_reference" VARCHAR(120),
  "dispute_reason" VARCHAR(1000),
  "resolution_note" VARCHAR(1000),
  "resolved_by_user_id" UUID,
  "resolved_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "job_payments_payment_reference_key" UNIQUE ("payment_reference"),
  CONSTRAINT "job_payments_job_id_key" UNIQUE ("job_id"),
  CONSTRAINT "job_payments_quote_id_key" UNIQUE ("quote_id"),
  CONSTRAINT "job_payments_gross_positive_check" CHECK ("gross_amount_minor" > 0),
  CONSTRAINT "job_payments_commission_rate_check" CHECK ("commission_basis_points" BETWEEN 0 AND 3000),
  CONSTRAINT "job_payments_amounts_check" CHECK ("commission_amount_minor" BETWEEN 0 AND "gross_amount_minor" AND "provider_amount_minor" = "gross_amount_minor" - "commission_amount_minor"),
  CONSTRAINT "job_payments_paid_confirmation_check" CHECK ("status" <> 'PAID' OR ("method" IS NOT NULL AND "confirmed_at" IS NOT NULL)),
  CONSTRAINT "job_payments_platform_fee_reported_check" CHECK ("platform_fee_status" NOT IN ('REPORTED', 'RECEIVED') OR ("platform_fee_reported_by_user_id" IS NOT NULL AND "platform_fee_reported_at" IS NOT NULL AND "platform_fee_payment_reference" IS NOT NULL)),
  CONSTRAINT "job_payments_platform_fee_received_check" CHECK ("platform_fee_status" <> 'RECEIVED' OR ("platform_fee_received_at" IS NOT NULL AND "platform_fee_receipt_reference" IS NOT NULL)),
  CONSTRAINT "job_payments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "job_payments_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "job_payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "job_payments_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "job_payments_customer_id_status_created_at_idx" ON "job_payments"("customer_id", "status", "created_at");
CREATE INDEX "job_payments_provider_id_status_created_at_idx" ON "job_payments"("provider_id", "status", "created_at");
CREATE INDEX "job_payments_status_created_at_idx" ON "job_payments"("status", "created_at");

CREATE TABLE "job_payment_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_id" UUID NOT NULL,
  "actor_id" UUID,
  "action" VARCHAR(80) NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "request_id" VARCHAR(80) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_payment_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "job_payment_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "job_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "job_payment_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "job_payment_events_payment_action_request_key" UNIQUE ("payment_id", "action", "request_id")
);
CREATE INDEX "job_payment_events_payment_id_created_at_idx" ON "job_payment_events"("payment_id", "created_at");

INSERT INTO "job_payments" (
  "job_id", "quote_id", "customer_id", "provider_id", "gross_amount_minor",
  "commission_basis_points", "commission_amount_minor", "provider_amount_minor", "currency"
)
SELECT j.id, q.id, j.customer_id, q.provider_id, q.amount_minor,
  rate.bps,
  round(q.amount_minor::numeric * rate.bps / 10000)::bigint,
  q.amount_minor - round(q.amount_minor::numeric * rate.bps / 10000)::bigint,
  q.currency
FROM "jobs" j
JOIN "quotes" q ON q.job_id = j.id AND q.status = 'ACCEPTED'
CROSS JOIN LATERAL (
  SELECT round(COALESCE((s.value->>'marketplaceCommissionPercent')::numeric, 10) * 100)::integer AS bps
  FROM (SELECT 1) seed
  LEFT JOIN "admin_settings" s ON s.key = 'marketplace'
) rate
ON CONFLICT ("job_id") DO NOTHING;

INSERT INTO "job_payment_events" ("payment_id", "actor_id", "action", "metadata", "request_id")
SELECT p.id, p.customer_id, 'payment.agreed', jsonb_build_object('backfilled', true, 'grossAmountMinor', p.gross_amount_minor), 'migration:20261123160000_job_payment_ledger'
FROM "job_payments" p
ON CONFLICT ("payment_id", "action", "request_id") DO NOTHING;

COMMIT;
