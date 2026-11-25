BEGIN;

-- Keep all existing public IDs. New job and booking references use a random
-- opaque suffix while the UUID primary keys and all foreign keys stay intact.
ALTER TABLE "jobs" ALTER COLUMN "job_reference" TYPE VARCHAR(23);
ALTER TABLE "service_listings" ALTER COLUMN "job_reference" TYPE VARCHAR(23);
ALTER TABLE "jobs" ALTER COLUMN "job_reference"
  SET DEFAULT ('OJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)));
ALTER TABLE "service_listings" ALTER COLUMN "job_reference"
  SET DEFAULT ('OJ-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)));

-- New support tickets get an opaque reference too. Existing SUP references
-- remain unchanged and continue to resolve.
ALTER TABLE "support_cases" ALTER COLUMN "case_reference" TYPE VARCHAR(20);
ALTER TABLE "support_cases" ALTER COLUMN "case_reference"
  SET DEFAULT ('SUP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)));

COMMIT;