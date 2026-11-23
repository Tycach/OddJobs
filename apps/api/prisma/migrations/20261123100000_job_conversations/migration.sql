-- Keep conversations private to the job poster and one worker.
CREATE TABLE "job_conversations" (
  "id" UUID NOT NULL,
  "job_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "provider_id" UUID NOT NULL,
  "quote_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "job_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "job_conversations_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "job_conversations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "job_conversations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "job_conversations_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "job_conversations_quote_id_key" ON "job_conversations"("quote_id");
CREATE UNIQUE INDEX "job_conversations_job_id_provider_id_key" ON "job_conversations"("job_id", "provider_id");
CREATE INDEX "job_conversations_customer_id_updated_at_idx" ON "job_conversations"("customer_id", "updated_at");
CREATE INDEX "job_conversations_provider_id_updated_at_idx" ON "job_conversations"("provider_id", "updated_at");
ALTER TABLE "messages" ADD COLUMN "conversation_id" UUID;
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "job_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

