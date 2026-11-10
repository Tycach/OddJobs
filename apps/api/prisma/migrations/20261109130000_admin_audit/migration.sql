CREATE TABLE "admin_audit_events" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(80),
    "target_id" VARCHAR(160),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "request_id" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_audit_events_created_at_id_idx"
    ON "admin_audit_events"("created_at", "id");
CREATE INDEX "admin_audit_events_actor_user_id_created_at_idx"
    ON "admin_audit_events"("actor_user_id", "created_at");
