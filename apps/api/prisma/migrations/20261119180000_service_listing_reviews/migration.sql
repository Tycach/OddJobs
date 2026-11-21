CREATE TABLE "service_listing_reviews" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "reviewer_user_id" UUID NOT NULL,
    "reviewee_user_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(2000) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "service_listing_reviews_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "service_listing_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5),
    CONSTRAINT "service_listing_reviews_distinct_users_check" CHECK ("reviewer_user_id" <> "reviewee_user_id"),
    CONSTRAINT "service_listing_reviews_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "service_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "service_listing_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "service_listing_reviews_reviewee_user_id_fkey" FOREIGN KEY ("reviewee_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "service_listing_reviews_listing_id_reviewer_user_id_key"
    ON "service_listing_reviews"("listing_id", "reviewer_user_id");
CREATE INDEX "service_listing_reviews_reviewee_user_id_created_at_idx"
    ON "service_listing_reviews"("reviewee_user_id", "created_at");
CREATE INDEX "service_listing_reviews_reviewer_user_id_created_at_idx"
    ON "service_listing_reviews"("reviewer_user_id", "created_at");

ALTER TABLE "service_listing_reviews" ENABLE ROW LEVEL SECURITY;
