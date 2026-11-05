CREATE TYPE "policy_document" AS ENUM ('TERMS', 'PRIVACY');

CREATE TABLE "policy_consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document" "policy_document" NOT NULL,
    "version" VARCHAR(40) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_consents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "policy_consents_user_id_document_version_key"
    ON "policy_consents"("user_id", "document", "version");

CREATE INDEX "policy_consents_user_id_accepted_at_idx"
    ON "policy_consents"("user_id", "accepted_at");

ALTER TABLE "policy_consents"
    ADD CONSTRAINT "policy_consents_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
