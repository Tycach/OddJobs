BEGIN;

INSERT INTO "service_categories" ("id", "name", "slug", "active", "sort_order", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'Cleaning', 'cleaning', TRUE, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Plumbing', 'plumbing', TRUE, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Electrical', 'electrical', TRUE, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Care', 'care', TRUE, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Grooming', 'grooming', TRUE, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Tutoring', 'tutoring', TRUE, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Moving', 'moving', TRUE, 70, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Repairs', 'repairs', TRUE, 80, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

COMMIT;
