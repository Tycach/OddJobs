CREATE TYPE "moderation_report_status" AS ENUM (
    'OPEN',
    'REVIEWING',
    'RESOLVED',
    'DISMISSED'
);

CREATE TABLE "provider_verification_reviews" (
    "id" UUID NOT NULL,
    "provider_profile_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "decision" "verification_status" NOT NULL,
    "reason" VARCHAR(1000),
    "request_id" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_verification_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "provider_verification_reviews_provider_profile_id_fkey"
        FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "provider_verification_reviews_provider_profile_id_created_at_idx"
    ON "provider_verification_reviews"("provider_profile_id", "created_at");
CREATE INDEX "provider_verification_reviews_actor_user_id_created_at_idx"
    ON "provider_verification_reviews"("actor_user_id", "created_at");

CREATE TABLE "moderation_reports" (
    "id" UUID NOT NULL,
    "reporter_user_id" UUID NOT NULL,
    "subject_type" VARCHAR(40) NOT NULL,
    "subject_id" VARCHAR(160) NOT NULL,
    "reason" VARCHAR(80) NOT NULL,
    "details" VARCHAR(2000) NOT NULL,
    "status" "moderation_report_status" NOT NULL DEFAULT 'OPEN',
    "decision_reason" VARCHAR(1000),
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "moderation_reports_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "moderation_reports_reporter_user_id_fkey"
        FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "moderation_reports_status_created_at_idx"
    ON "moderation_reports"("status", "created_at");
CREATE INDEX "moderation_reports_subject_type_subject_id_created_at_idx"
    ON "moderation_reports"("subject_type", "subject_id", "created_at");
