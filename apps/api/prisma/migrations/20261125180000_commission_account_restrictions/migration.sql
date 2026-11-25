BEGIN;

CREATE TYPE "account_restriction_type" AS ENUM ('COMMISSION');

CREATE TABLE "account_restrictions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "type" "account_restriction_type" NOT NULL DEFAULT 'COMMISSION',
  "reason" VARCHAR(1000) NOT NULL,
  "actor_user_id" UUID NOT NULL,
  "released_by_user_id" UUID,
  "release_reason" VARCHAR(1000),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "released_at" TIMESTAMPTZ(3),
  CONSTRAINT "account_restrictions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_restrictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "account_restrictions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "account_restrictions_released_by_user_id_fkey" FOREIGN KEY ("released_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "account_restrictions_user_id_released_at_created_at_idx"
  ON "account_restrictions"("user_id", "released_at", "created_at");
CREATE UNIQUE INDEX "account_restrictions_one_active_per_user_type_idx"
  ON "account_restrictions"("user_id", "type") WHERE "released_at" IS NULL;

COMMIT;