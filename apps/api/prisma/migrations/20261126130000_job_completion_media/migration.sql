ALTER TABLE "jobs"
  ADD COLUMN "completion_media" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "jobs"
  ADD CONSTRAINT "jobs_completion_media_array_check"
  CHECK (jsonb_typeof("completion_media") = 'array');
