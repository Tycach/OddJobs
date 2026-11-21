CREATE TYPE "job_location_mode" AS ENUM ('ONSITE', 'REMOTE', 'FLEXIBLE');

ALTER TYPE "job_status" ADD VALUE IF NOT EXISTS 'REVISION_REQUESTED';
ALTER TYPE "job_status" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE "jobs"
  ADD COLUMN "application_deadline_at" TIMESTAMPTZ(3),
  ADD COLUMN "due_at" TIMESTAMPTZ(3),
  ADD COLUMN "location_mode" "job_location_mode" NOT NULL DEFAULT 'ONSITE',
  ADD COLUMN "location_latitude" DOUBLE PRECISION,
  ADD COLUMN "location_longitude" DOUBLE PRECISION,
  ADD COLUMN "completion_note" VARCHAR(5000),
  ADD COLUMN "revision_note" VARCHAR(2000);

ALTER TABLE "jobs"
  ADD CONSTRAINT "jobs_location_coordinates_pair_check"
  CHECK (("location_latitude" IS NULL) = ("location_longitude" IS NULL)),
  ADD CONSTRAINT "jobs_location_latitude_range_check"
  CHECK ("location_latitude" IS NULL OR ("location_latitude" BETWEEN -90 AND 90)),
  ADD CONSTRAINT "jobs_location_longitude_range_check"
  CHECK ("location_longitude" IS NULL OR ("location_longitude" BETWEEN -180 AND 180));

CREATE INDEX "jobs_status_application_deadline_at_idx"
  ON "jobs"("status", "application_deadline_at");

WITH ranked_active_quotes AS (
  SELECT "id", ROW_NUMBER() OVER (
    PARTITION BY "job_id", "provider_id"
    ORDER BY "updated_at" DESC, "created_at" DESC, "id" DESC
  ) AS "position"
  FROM "quotes"
  WHERE "status" = 'SUBMITTED'
)
UPDATE "quotes" AS quote
SET "status" = 'WITHDRAWN'
FROM ranked_active_quotes AS duplicate
WHERE quote."id" = duplicate."id" AND duplicate."position" > 1;

CREATE UNIQUE INDEX "quotes_one_active_per_provider_per_job_key"
  ON "quotes"("job_id", "provider_id")
  WHERE ("status" = 'SUBMITTED');
