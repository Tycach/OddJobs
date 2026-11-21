CREATE TYPE "listing_status" AS ENUM (
  'OPEN', 'CLAIMED', 'IN_PROGRESS', 'COMPLETION_PENDING', 'COMPLETED', 'CANCELLED'
);

CREATE TABLE "service_listings" (
  "id" UUID NOT NULL,
  "provider_id" UUID NOT NULL,
  "claimed_by_customer_id" UUID,
  "title" VARCHAR(160) NOT NULL,
  "description" VARCHAR(5000) NOT NULL,
  "category" VARCHAR(80) NOT NULL,
  "location_label" VARCHAR(160) NOT NULL,
  "budget_minor" BIGINT,
  "currency" CHAR(3) NOT NULL DEFAULT 'KES',
  "status" "listing_status" NOT NULL DEFAULT 'OPEN',
  "claim_expires_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_listings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_listings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "service_listings_claimed_by_customer_id_fkey" FOREIGN KEY ("claimed_by_customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "service_listings_distinct_participants_check" CHECK ("claimed_by_customer_id" IS NULL OR "claimed_by_customer_id" <> "provider_id"),
  CONSTRAINT "service_listings_claim_state_check" CHECK (("status" = 'OPEN' AND "claimed_by_customer_id" IS NULL) OR ("status" <> 'OPEN' AND "status" <> 'CANCELLED' AND "claimed_by_customer_id" IS NOT NULL) OR "status" = 'CANCELLED')
);

CREATE INDEX "service_listings_status_category_created_at_idx" ON "service_listings"("status", "category", "created_at");
CREATE INDEX "service_listings_provider_id_status_created_at_idx" ON "service_listings"("provider_id", "status", "created_at");
CREATE INDEX "service_listings_claimed_by_customer_id_status_created_at_idx" ON "service_listings"("claimed_by_customer_id", "status", "created_at");

ALTER TABLE "service_listings" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "service_listing_activity" (
  "id" UUID NOT NULL,
  "listing_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "action" VARCHAR(80) NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "request_id" VARCHAR(80) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_listing_activity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_listing_activity_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "service_listing_activity_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "service_listing_activity_listing_id_created_at_idx" ON "service_listing_activity"("listing_id", "created_at");
CREATE INDEX "service_listing_activity_actor_user_id_created_at_idx" ON "service_listing_activity"("actor_user_id", "created_at");
ALTER TABLE "service_listing_activity" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regrole('authenticated') IS NOT NULL AND to_regprocedure('auth.uid()') IS NOT NULL THEN
    CREATE POLICY "eligible marketplace users can read service listings"
      ON public.service_listings FOR SELECT TO authenticated
      USING (
        (provider_id = (SELECT auth.uid()) AND EXISTS (
          SELECT 1 FROM public.users account
          JOIN public.user_role_assignments assignment ON assignment.user_id = account.id
          WHERE account.id = (SELECT auth.uid()) AND account.status = 'ACTIVE' AND assignment.role = 'PROVIDER'
        ))
        OR (claimed_by_customer_id = (SELECT auth.uid()) AND EXISTS (
          SELECT 1 FROM public.users account
          JOIN public.user_role_assignments assignment ON assignment.user_id = account.id
          WHERE account.id = (SELECT auth.uid()) AND account.status = 'ACTIVE' AND assignment.role = 'CONSUMER'
        ))
        OR (status = 'OPEN' AND EXISTS (
          SELECT 1 FROM public.users account
          JOIN public.user_role_assignments assignment ON assignment.user_id = account.id
          WHERE account.id = (SELECT auth.uid()) AND account.status = 'ACTIVE' AND assignment.role = 'CONSUMER'
        ))
        OR EXISTS (
          SELECT 1 FROM public.users account
          JOIN public.user_role_assignments assignment ON assignment.user_id = account.id
          WHERE account.id = (SELECT auth.uid()) AND account.status = 'ACTIVE' AND assignment.role = 'ADMIN'
        )
      );

    CREATE POLICY "listing participants and admins can read listing activity"
      ON public.service_listing_activity FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.service_listings listing
        WHERE listing.id = listing_id AND (
          (listing.provider_id = (SELECT auth.uid()) AND EXISTS (
            SELECT 1 FROM public.users account
            JOIN public.user_role_assignments assignment ON assignment.user_id = account.id
            WHERE account.id = (SELECT auth.uid()) AND account.status = 'ACTIVE' AND assignment.role = 'PROVIDER'
          ))
          OR (listing.claimed_by_customer_id = (SELECT auth.uid()) AND EXISTS (
            SELECT 1 FROM public.users account
            JOIN public.user_role_assignments assignment ON assignment.user_id = account.id
            WHERE account.id = (SELECT auth.uid()) AND account.status = 'ACTIVE' AND assignment.role = 'CONSUMER'
          ))
          OR EXISTS (
            SELECT 1 FROM public.users account
            JOIN public.user_role_assignments assignment ON assignment.user_id = account.id
            WHERE account.id = (SELECT auth.uid()) AND account.status = 'ACTIVE' AND assignment.role = 'ADMIN'
          )
        )
      ));
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'service_listings'
    ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.service_listings;
  END IF;
END;
$$;
