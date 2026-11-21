ALTER TABLE "provider_profiles"
  ADD COLUMN "verification_document_type" VARCHAR(40),
  ADD COLUMN "verification_document_path" VARCHAR(300),
  ADD COLUMN "skills_evidence" VARCHAR(2000);

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL
    AND to_regclass('storage.objects') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'provider-verification',
      'provider-verification',
      false,
      8388608,
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    )
    ON CONFLICT (id) DO UPDATE SET
      public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

    DROP POLICY IF EXISTS "verification owner upload" ON storage.objects;
    CREATE POLICY "verification owner upload"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'provider-verification'
        AND (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
      );

    DROP POLICY IF EXISTS "verification owner read" ON storage.objects;
    CREATE POLICY "verification owner read"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'provider-verification'
        AND (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
      );
  END IF;
END $$;
