ALTER TABLE "service_listings"
ADD COLUMN "media" JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL
    AND to_regclass('storage.objects') IS NOT NULL THEN
    INSERT INTO storage.buckets (
      id,
      name,
      public,
      file_size_limit,
      allowed_mime_types
    ) VALUES (
      'listing-media',
      'listing-media',
      TRUE,
      6291456,
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
    )
    ON CONFLICT (id) DO UPDATE SET
      public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'listing media upload to own folder'
    ) THEN
      CREATE POLICY "listing media upload to own folder"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = 'listing-media'
          AND (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
          AND EXISTS (
            SELECT 1
            FROM public.user_role_assignments assignment
            JOIN public.users account ON account.id = assignment.user_id
            WHERE assignment.user_id = (SELECT auth.uid())
              AND assignment.role = 'PROVIDER'
              AND account.status = 'ACTIVE'
          )
        );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'listing media delete from own folder'
    ) THEN
      CREATE POLICY "listing media delete from own folder"
        ON storage.objects FOR DELETE TO authenticated
        USING (
          bucket_id = 'listing-media'
          AND (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub')
          AND EXISTS (
            SELECT 1
            FROM public.user_role_assignments assignment
            JOIN public.users account ON account.id = assignment.user_id
            WHERE assignment.user_id = (SELECT auth.uid())
              AND assignment.role = 'PROVIDER'
              AND account.status = 'ACTIVE'
          )
        );
    END IF;
  END IF;
END;
$$;
