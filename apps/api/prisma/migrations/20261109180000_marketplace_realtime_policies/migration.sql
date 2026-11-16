ALTER TABLE "quotes"
ADD COLUMN "availability" VARCHAR(120) NOT NULL DEFAULT '';

ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regrole('authenticated') IS NOT NULL
    AND to_regprocedure('auth.uid()') IS NOT NULL THEN
    EXECUTE $function$
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
              OR EXISTS (
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
        );
      $body$;
    $function$;

    EXECUTE $function$
      CREATE OR REPLACE FUNCTION public.oddjobs_is_job_customer(target_job_id UUID)
      RETURNS BOOLEAN
      LANGUAGE SQL
      STABLE
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $body$
        SELECT EXISTS (
          SELECT 1
          FROM public.jobs AS job
          JOIN public.users AS account ON account.id = job.customer_id
          JOIN public.user_role_assignments AS role_assignment
            ON role_assignment.user_id = account.id
          WHERE job.id = target_job_id
            AND job.customer_id = (SELECT auth.uid())
            AND account.status = 'ACTIVE'
            AND role_assignment.role = 'CONSUMER'
        );
      $body$;
    $function$;

    EXECUTE 'REVOKE ALL ON FUNCTION public.oddjobs_can_read_job(UUID) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.oddjobs_is_job_customer(UUID) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.oddjobs_can_read_job(UUID) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.oddjobs_is_job_customer(UUID) TO authenticated';
    EXECUTE $policy$
      CREATE POLICY "marketplace participants can read jobs"
      ON public.jobs
      FOR SELECT
      TO authenticated
      USING (public.oddjobs_can_read_job(id))
    $policy$;
    EXECUTE $policy$
      CREATE POLICY "marketplace participants can read quotes"
      ON public.quotes
      FOR SELECT
      TO authenticated
      USING (
        (
          provider_id = (SELECT auth.uid())
          AND EXISTS (
            SELECT 1
            FROM public.users AS account
            JOIN public.user_role_assignments AS role_assignment
              ON role_assignment.user_id = account.id
            WHERE account.id = (SELECT auth.uid())
              AND account.status = 'ACTIVE'
              AND role_assignment.role = 'PROVIDER'
          )
        )
        OR public.oddjobs_is_job_customer(job_id)
      )
    $policy$;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'jobs'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'quotes'
    ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes';
    END IF;
  END IF;
END;
$$;
