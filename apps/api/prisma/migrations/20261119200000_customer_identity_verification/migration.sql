CREATE TABLE "customer_identity_verifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_type" VARCHAR(40) NOT NULL,
    "document_path" VARCHAR(300) NOT NULL,
    "status" "verification_status" NOT NULL DEFAULT 'IN_REVIEW',
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ(3),
    "reviewed_by_user_id" UUID,
    "review_reason" VARCHAR(1000),
    CONSTRAINT "customer_identity_verifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_identity_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "customer_identity_verifications_user_id_key"
    ON "customer_identity_verifications"("user_id");
CREATE INDEX "customer_identity_verifications_status_submitted_at_idx"
    ON "customer_identity_verifications"("status", "submitted_at");
ALTER TABLE "customer_identity_verifications" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL AND to_regclass('storage.objects') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('customer-verification', 'customer-verification', false, 8388608, ARRAY['image/jpeg','image/png','image/webp','application/pdf']::text[])
    ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 8388608, allowed_mime_types = EXCLUDED.allowed_mime_types;

    DROP POLICY IF EXISTS "customer verification owner upload" ON storage.objects;
    CREATE POLICY "customer verification owner upload" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'customer-verification' AND (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub'));

    DROP POLICY IF EXISTS "customer verification owner read" ON storage.objects;
    CREATE POLICY "customer verification owner read" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'customer-verification' AND (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub'));
  END IF;
END $$;
