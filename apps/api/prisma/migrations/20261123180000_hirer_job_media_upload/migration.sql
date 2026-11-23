DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL
    AND to_regclass('storage.objects') IS NOT NULL THEN
    -- Job attachments use the shared listing-media bucket today. Permit active
    -- hirers and providers to upload/remove files only inside their own folder.
    DROP POLICY IF EXISTS "listing media upload to own folder" ON storage.objects;
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
            AND assignment.role IN ('CONSUMER', 'PROVIDER')
            AND account.status = 'ACTIVE'
        )
      );

    DROP POLICY IF EXISTS "listing media delete from own folder" ON storage.objects;
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
            AND assignment.role IN ('CONSUMER', 'PROVIDER')
            AND account.status = 'ACTIVE'
        )
      );
  END IF;
END
$$;
