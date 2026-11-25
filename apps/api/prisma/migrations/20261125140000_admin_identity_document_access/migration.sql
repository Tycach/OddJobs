-- Allow authenticated administrators to read private identity documents for
-- review. The API still authorizes the admin routes and audits every signed URL.
DROP POLICY IF EXISTS "provider verification admin read" ON storage.objects;
CREATE POLICY "provider verification admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'provider-verification'
    AND EXISTS (
      SELECT 1
      FROM public.user_role_assignments assignment
      JOIN public.users account ON account.id = assignment.user_id
      WHERE assignment.user_id = (SELECT auth.uid())
        AND assignment.role = 'ADMIN'
        AND account.status = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS "customer verification admin read" ON storage.objects;
CREATE POLICY "customer verification admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'customer-verification'
    AND EXISTS (
      SELECT 1
      FROM public.user_role_assignments assignment
      JOIN public.users account ON account.id = assignment.user_id
      WHERE assignment.user_id = (SELECT auth.uid())
        AND assignment.role = 'ADMIN'
        AND account.status = 'ACTIVE'
    )
  );
