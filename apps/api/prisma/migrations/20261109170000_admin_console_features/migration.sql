CREATE TYPE "ad_campaign_status" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);

CREATE TABLE "service_categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(90) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_categories_name_key" ON "service_categories"("name");
CREATE UNIQUE INDEX "service_categories_slug_key" ON "service_categories"("slug");
CREATE INDEX "service_categories_active_sort_order_name_idx"
    ON "service_categories"("active", "sort_order", "name");

CREATE TABLE "admin_settings" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "ad_campaigns" (
    "id" UUID NOT NULL,
    "advertiser_id" UUID,
    "advertiser_name" VARCHAR(120) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "placement" VARCHAR(40) NOT NULL,
    "destination_url" VARCHAR(2048),
    "status" "ad_campaign_status" NOT NULL DEFAULT 'PENDING',
    "decision_reason" VARCHAR(1000),
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ad_campaigns_status_created_at_idx"
    ON "ad_campaigns"("status", "created_at");

CREATE TABLE "admin_user_enforcements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "released_by" UUID,
    "released_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_user_enforcements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_user_enforcements_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "admin_user_enforcements_report_id_fkey"
        FOREIGN KEY ("report_id") REFERENCES "moderation_reports"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "admin_user_enforcements_report_id_key"
    ON "admin_user_enforcements"("report_id");
CREATE INDEX "admin_user_enforcements_user_id_released_at_idx"
    ON "admin_user_enforcements"("user_id", "released_at");

CREATE TABLE "admin_monitoring_snapshots" (
    "id" UUID NOT NULL,
    "database" VARCHAR(20) NOT NULL,
    "pending_verifications" INTEGER NOT NULL,
    "open_reports" INTEGER NOT NULL,
    "heap_used_bytes" BIGINT NOT NULL,
    "heap_limit_bytes" BIGINT NOT NULL,
    "alerts" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_monitoring_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_monitoring_snapshots_created_at_idx"
    ON "admin_monitoring_snapshots"("created_at");
