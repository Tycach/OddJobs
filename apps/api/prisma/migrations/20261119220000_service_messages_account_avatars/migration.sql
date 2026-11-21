ALTER TABLE "users" ADD COLUMN "avatar_path" VARCHAR(300);

CREATE TABLE "service_listing_messages" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" VARCHAR(5000) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "service_listing_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "service_listing_messages_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "service_listing_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "service_listing_messages_listing_id_created_at_idx" ON "service_listing_messages"("listing_id", "created_at");
CREATE INDEX "service_listing_messages_sender_id_created_at_idx" ON "service_listing_messages"("sender_id", "created_at");
ALTER TABLE "service_listing_messages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service listing participants read messages" ON "service_listing_messages" FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.service_listings listing
    WHERE listing.id = listing_id
      AND (listing.provider_id = (SELECT auth.uid()) OR listing.claimed_by_customer_id = (SELECT auth.uid()))
  ));
CREATE POLICY "service listing participants send messages" ON "service_listing_messages" FOR INSERT TO authenticated
  WITH CHECK (sender_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.service_listings listing
    WHERE listing.id = listing_id
      AND listing.status <> 'OPEN'
      AND listing.status <> 'CANCELLED'
      AND (listing.provider_id = (SELECT auth.uid()) OR listing.claimed_by_customer_id = (SELECT auth.uid()))
  ));

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL AND to_regclass('storage.objects') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('account-avatars', 'account-avatars', true, 2097152, ARRAY['image/jpeg','image/png','image/webp']::text[])
    ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152, allowed_mime_types = EXCLUDED.allowed_mime_types;

    DROP POLICY IF EXISTS "account avatar owner upload" ON storage.objects;
    CREATE POLICY "account avatar owner upload" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'account-avatars' AND (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub'));
    DROP POLICY IF EXISTS "account avatar owner delete" ON storage.objects;
    CREATE POLICY "account avatar owner delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'account-avatars' AND (storage.foldername(name))[1] = (SELECT auth.jwt()->>'sub'));
  END IF;
END $$;
