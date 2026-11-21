CREATE TABLE "saved_providers" (
  "customer_id" UUID NOT NULL,
  "provider_profile_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_providers_pkey" PRIMARY KEY ("customer_id", "provider_profile_id"),
  CONSTRAINT "saved_providers_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "saved_providers_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "saved_providers_provider_profile_id_created_at_idx"
  ON "saved_providers"("provider_profile_id", "created_at");
