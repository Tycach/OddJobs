CREATE TABLE public.marketplace_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type varchar(60) NOT NULL,
  title varchar(160) NOT NULL,
  body varchar(500) NOT NULL,
  job_id uuid,
  read_at timestamptz(3),
  dedupe_key varchar(180) NOT NULL UNIQUE,
  created_at timestamptz(3) NOT NULL DEFAULT now()
);

CREATE INDEX marketplace_notifications_user_created_idx
  ON public.marketplace_notifications(user_id, created_at DESC, id DESC);

CREATE INDEX marketplace_notifications_user_read_created_idx
  ON public.marketplace_notifications(user_id, read_at, created_at DESC);

CREATE TABLE public.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type varchar(80) NOT NULL,
  aggregate_type varchar(40) NOT NULL,
  aggregate_id uuid,
  recipient_user_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id varchar(80) NOT NULL,
  dedupe_key varchar(180) NOT NULL UNIQUE,
  status varchar(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processed', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz(3) NOT NULL DEFAULT now(),
  processed_at timestamptz(3),
  last_error varchar(1000),
  created_at timestamptz(3) NOT NULL DEFAULT now()
);

CREATE INDEX outbox_events_delivery_idx
  ON public.outbox_events(status, available_at, created_at);

CREATE INDEX outbox_events_aggregate_idx
  ON public.outbox_events(aggregate_type, aggregate_id, created_at);
