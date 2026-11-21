ALTER TABLE "jobs"
  ADD COLUMN "media" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "jobs"
  ADD CONSTRAINT "jobs_media_is_array_check"
  CHECK (jsonb_typeof("media") = 'array');
