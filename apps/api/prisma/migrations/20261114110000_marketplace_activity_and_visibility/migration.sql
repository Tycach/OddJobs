CREATE TABLE "marketplace_activity_events" (
  "id" UUID NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "actor_role" VARCHAR(20) NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "job_id" UUID NOT NULL,
  "quote_id" UUID,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "request_id" VARCHAR(80) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "marketplace_activity_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "marketplace_activity_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "marketplace_activity_events_created_at_id_idx"
  ON "marketplace_activity_events"("created_at", "id");
CREATE INDEX "marketplace_activity_events_job_id_created_at_idx"
  ON "marketplace_activity_events"("job_id", "created_at");
CREATE INDEX "marketplace_activity_events_actor_user_id_created_at_idx"
  ON "marketplace_activity_events"("actor_user_id", "created_at");

ALTER TABLE "marketplace_activity_events" ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.oddjobs_can_read_job(target_job_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $body$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs AS job
    WHERE job.id = target_job_id
      AND (
        (
          job.customer_id = (SELECT auth.uid())
          AND EXISTS (
            SELECT 1
            FROM public.users AS account
            JOIN public.user_role_assignments AS role_assignment
              ON role_assignment.user_id = account.id
            WHERE account.id = (SELECT auth.uid())
              AND account.status = 'ACTIVE'
              AND role_assignment.role = 'CONSUMER'
          )
        )
        OR (
          job.customer_id <> (SELECT auth.uid())
          AND EXISTS (
            SELECT 1
            FROM public.users AS account
            JOIN public.user_role_assignments AS role_assignment
              ON role_assignment.user_id = account.id
            WHERE account.id = (SELECT auth.uid())
              AND account.status = 'ACTIVE'
              AND role_assignment.role = 'PROVIDER'
              AND (
                job.status = 'OPEN'
                OR EXISTS (
                  SELECT 1
                  FROM public.quotes AS quote
                  WHERE quote.job_id = job.id
                    AND quote.provider_id = account.id
                )
              )
          )
        )
      )
  );
$body$;

REVOKE ALL ON FUNCTION public.oddjobs_can_read_job(UUID) FROM PUBLIC;

DO $$
BEGIN
  IF to_regrole('authenticated') IS NOT NULL
    AND to_regprocedure('auth.uid()') IS NOT NULL THEN
    GRANT EXECUTE ON FUNCTION public.oddjobs_can_read_job(UUID) TO authenticated;

    DROP POLICY IF EXISTS "marketplace participants can read quotes" ON public.quotes;
    CREATE POLICY "marketplace participants can read quotes"
      ON public.quotes
      FOR SELECT
      TO authenticated
      USING (
        (
          provider_id = (SELECT auth.uid())
          AND EXISTS (
            SELECT 1
            FROM public.jobs AS job
            JOIN public.users AS account ON account.id = provider_id
            JOIN public.user_role_assignments AS role_assignment
              ON role_assignment.user_id = account.id
            WHERE job.id = job_id
              AND job.customer_id <> (SELECT auth.uid())
              AND account.status = 'ACTIVE'
              AND role_assignment.role = 'PROVIDER'
          )
        )
        OR public.oddjobs_is_job_customer(job_id)
      );
  END IF;
END;
$$;
