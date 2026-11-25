CREATE TYPE "admin_member_role" AS ENUM ('OWNER', 'ADMIN', 'OPERATIONS_ADMIN', 'VERIFICATION_REVIEWER', 'MODERATION_REVIEWER', 'SUPPORT_AGENT', 'FINANCE_REVIEWER', 'ANALYST');
CREATE TYPE "admin_invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
CREATE TYPE "admin_alert_status" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

CREATE TABLE "admin_members" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "admin_member_role" NOT NULL,
  "assigned_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "admin_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "admin_members_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "admin_members_user_id_key" ON "admin_members"("user_id");
CREATE INDEX "admin_members_role_created_at_idx" ON "admin_members"("role", "created_at");

CREATE TABLE "admin_invitations" (
  "id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "role" "admin_member_role" NOT NULL,
  "status" "admin_invitation_status" NOT NULL DEFAULT 'PENDING',
  "token_hash" CHAR(64) NOT NULL,
  "invited_by" UUID NOT NULL,
  "accepted_by" UUID,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "accepted_at" TIMESTAMPTZ(3),
  "revoked_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "admin_invitations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "admin_invitations_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "admin_invitations_token_hash_key" ON "admin_invitations"("token_hash");
CREATE INDEX "admin_invitations_email_status_created_at_idx" ON "admin_invitations"("email", "status", "created_at");
CREATE INDEX "admin_invitations_status_expires_at_idx" ON "admin_invitations"("status", "expires_at");

CREATE TABLE "admin_alerts" (
  "id" UUID NOT NULL,
  "code" VARCHAR(100) NOT NULL,
  "dedupe_key" VARCHAR(180),
  "severity" VARCHAR(20) NOT NULL,
  "message" VARCHAR(500) NOT NULL,
  "status" "admin_alert_status" NOT NULL DEFAULT 'OPEN',
  "first_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledged_at" TIMESTAMPTZ(3),
  "acknowledged_by" UUID,
  "assigned_admin_id" UUID,
  "resolved_at" TIMESTAMPTZ(3),
  "resolved_by" UUID,
  "resolution_note" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "admin_alerts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_alerts_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "admin_alerts_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "admin_alerts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "admin_alerts_dedupe_key_key" ON "admin_alerts"("dedupe_key");
CREATE INDEX "admin_alerts_status_severity_last_seen_at_idx" ON "admin_alerts"("status", "severity", "last_seen_at");
CREATE INDEX "admin_alerts_assigned_admin_id_status_idx" ON "admin_alerts"("assigned_admin_id", "status");

CREATE TABLE "admin_alert_events" (
  "id" UUID NOT NULL,
  "alert_id" UUID NOT NULL,
  "actor_id" UUID NOT NULL,
  "action" VARCHAR(40) NOT NULL,
  "reason" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_alert_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_alert_events_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "admin_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "admin_alert_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "admin_alert_events_alert_id_created_at_idx" ON "admin_alert_events"("alert_id", "created_at");
