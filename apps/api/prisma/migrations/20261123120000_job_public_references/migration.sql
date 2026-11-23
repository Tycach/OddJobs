-- Public job references are support-friendly identifiers, not access tokens.
-- Keep the existing UUID primary keys for all relations and authorization.
BEGIN;
CREATE SEQUENCE "job_reference_seq" AS BIGINT START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

ALTER TABLE "jobs" ADD COLUMN "job_reference" VARCHAR(13);
ALTER TABLE "service_listings" ADD COLUMN "job_reference" VARCHAR(13);

CREATE TEMP TABLE "job_reference_backfill" (
  "entity_type" TEXT NOT NULL,
  "entity_id" UUID NOT NULL,
  "reference_number" BIGINT NOT NULL
);

INSERT INTO "job_reference_backfill" ("entity_type", "entity_id", "reference_number")
SELECT entity_type, entity_id, ROW_NUMBER() OVER (ORDER BY created_at, entity_type, entity_id)
FROM (
  SELECT 'job'::TEXT AS entity_type, id AS entity_id, created_at FROM "jobs"
  UNION ALL
  SELECT 'service_listing'::TEXT AS entity_type, id AS entity_id, created_at FROM "service_listings"
) existing_records;

UPDATE "jobs" AS target
SET "job_reference" = 'OJ-' || LPAD(backfill.reference_number::TEXT, 10, '0')
FROM "job_reference_backfill" AS backfill
WHERE backfill.entity_type = 'job' AND backfill.entity_id = target.id;

UPDATE "service_listings" AS target
SET "job_reference" = 'OJ-' || LPAD(backfill.reference_number::TEXT, 10, '0')
FROM "job_reference_backfill" AS backfill
WHERE backfill.entity_type = 'service_listing' AND backfill.entity_id = target.id;

SELECT setval('job_reference_seq', COALESCE((SELECT MAX(reference_number) FROM "job_reference_backfill"), 0) + 1, false);

ALTER TABLE "jobs" ALTER COLUMN "job_reference" SET NOT NULL;
ALTER TABLE "jobs" ALTER COLUMN "job_reference" SET DEFAULT ('OJ-' || LPAD(nextval('job_reference_seq')::TEXT, 10, '0'));
ALTER TABLE "service_listings" ALTER COLUMN "job_reference" SET NOT NULL;
ALTER TABLE "service_listings" ALTER COLUMN "job_reference" SET DEFAULT ('OJ-' || LPAD(nextval('job_reference_seq')::TEXT, 10, '0'));

CREATE UNIQUE INDEX "jobs_job_reference_key" ON "jobs"("job_reference");
CREATE UNIQUE INDEX "service_listings_job_reference_key" ON "service_listings"("job_reference");
DROP TABLE "job_reference_backfill";
COMMIT;
