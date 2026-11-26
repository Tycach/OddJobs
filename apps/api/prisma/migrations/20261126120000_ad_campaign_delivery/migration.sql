ALTER TABLE "ad_campaigns"
  ADD COLUMN "image_url" VARCHAR(2048),
  ADD COLUMN "start_at" TIMESTAMPTZ(3),
  ADD COLUMN "end_at" TIMESTAMPTZ(3),
  ADD COLUMN "price_minor" BIGINT,
  ADD COLUMN "payment_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN "payment_reference" VARCHAR(120);

CREATE INDEX "ad_campaigns_placement_status_dates_payment_idx"
  ON "ad_campaigns"("placement", "status", "start_at", "end_at", "payment_status");

CREATE TABLE "ad_campaign_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaign_id" UUID NOT NULL,
  "event_type" VARCHAR(12) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ad_campaign_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ad_campaign_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ad_campaign_events_type_check" CHECK ("event_type" IN ('impression', 'click'))
);

CREATE INDEX "ad_campaign_events_campaign_type_created_idx"
  ON "ad_campaign_events"("campaign_id", "event_type", "created_at");
