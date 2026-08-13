CREATE TABLE "shipmozo_operations" (
  "id" SERIAL PRIMARY KEY,
  "idempotency_key" VARCHAR(200) NOT NULL UNIQUE,
  "provider_order_id" VARCHAR(500) NOT NULL,
  "order_id" INTEGER,
  "return_request_id" INTEGER,
  "direction" VARCHAR(20) NOT NULL,
  "operation_type" VARCHAR(50) NOT NULL,
  "stage" VARCHAR(50) NOT NULL DEFAULT 'initialized',
  "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
  "awb_number" VARCHAR(500),
  "courier_name" VARCHAR(255),
  "provider_reference" VARCHAR(500),
  "request_payload" JSONB,
  "provider_response" JSONB,
  "last_provider_status" VARCHAR(500),
  "last_system_status" VARCHAR(100),
  "last_tracking_payload" JSONB,
  "last_synced_at" BIGINT,
  "next_sync_at" BIGINT,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "failure_reason" TEXT,
  "createddate" BIGINT NOT NULL,
  "modifieddate" BIGINT NOT NULL,
  "completeddate" BIGINT,
  CONSTRAINT "shipmozo_operations_direction_check" CHECK ("direction" IN ('forward', 'reverse')),
  CONSTRAINT "shipmozo_operations_status_check" CHECK ("status" IN ('pending', 'active', 'syncing', 'completed', 'cancelled', 'failed')),
  CONSTRAINT "shipmozo_operations_order_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL,
  CONSTRAINT "shipmozo_operations_return_request_fkey" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE SET NULL
);

CREATE INDEX "shipmozo_operations_order_id_idx" ON "shipmozo_operations"("order_id");
CREATE INDEX "shipmozo_operations_return_request_id_idx" ON "shipmozo_operations"("return_request_id");
CREATE INDEX "shipmozo_operations_awb_number_idx" ON "shipmozo_operations"("awb_number");
CREATE INDEX "shipmozo_operations_status_next_sync_at_idx" ON "shipmozo_operations"("status", "next_sync_at");
CREATE INDEX "shipmozo_operations_provider_order_id_idx" ON "shipmozo_operations"("provider_order_id");
