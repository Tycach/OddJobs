BEGIN;

ALTER TABLE "provider_profiles"
  ADD COLUMN "service_latitude" DOUBLE PRECISION,
  ADD COLUMN "service_longitude" DOUBLE PRECISION,
  ADD COLUMN "max_travel_distance_km" INTEGER NOT NULL DEFAULT 25,
  ADD CONSTRAINT "provider_profiles_service_coordinates_pair_check"
    CHECK (("service_latitude" IS NULL) = ("service_longitude" IS NULL)),
  ADD CONSTRAINT "provider_profiles_max_travel_distance_km_check"
    CHECK ("max_travel_distance_km" BETWEEN 1 AND 250),
  ADD CONSTRAINT "provider_profiles_service_latitude_check"
    CHECK ("service_latitude" IS NULL OR "service_latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "provider_profiles_service_longitude_check"
    CHECK ("service_longitude" IS NULL OR "service_longitude" BETWEEN -180 AND 180);

CREATE INDEX "provider_profiles_service_coordinates_idx"
  ON "provider_profiles"("service_latitude", "service_longitude");

ALTER TABLE "jobs"
  ADD COLUMN "share_exact_location_with_provider" BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
