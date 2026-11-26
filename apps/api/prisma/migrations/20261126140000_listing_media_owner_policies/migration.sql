-- Keep media uploads scoped to the authenticated user's own folder. Avoid
-- querying app tables from Storage RLS, where their row policies can hide a
-- valid active account from the nested policy check.
DROP POLICY IF EXISTS "listing media upload to own folder" ON storage.objects;
CREATE POLICY "listing media upload to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'listing-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    AND (storage.filename(name)) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,10}$'
  );

DROP POLICY IF EXISTS "listing media delete from own folder" ON storage.objects;
CREATE POLICY "listing media delete from own folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'listing-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    AND (storage.filename(name)) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,10}$'
  );
