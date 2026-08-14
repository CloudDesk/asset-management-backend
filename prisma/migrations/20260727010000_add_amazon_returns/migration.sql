CREATE TABLE "amazon_return_import_jobs" (
  "id" BIGSERIAL PRIMARY KEY,
  "sellerId" VARCHAR(255) NOT NULL,
  "marketplaceId" VARCHAR(50) NOT NULL,
  "fulfilmentType" VARCHAR(10) NOT NULL,
  "reportType" VARCHAR(100) NOT NULL,
  "amazonReportId" VARCHAR(255),
  "status" VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
  "activeKey" VARCHAR(350),
  "fetched" INTEGER NOT NULL DEFAULT 0,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "unmapped" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "requestedByUserId" INTEGER,
  "requestedByUserType" VARCHAR(30),
  "startedAt" TIMESTAMPTZ(3),
  "finishedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "amazon_return_import_jobs_activeKey_key" ON "amazon_return_import_jobs"("activeKey");
CREATE INDEX "amazon_return_import_jobs_scope_created_idx" ON "amazon_return_import_jobs"("sellerId", "marketplaceId", "createdAt");
CREATE INDEX "amazon_return_import_jobs_status_created_idx" ON "amazon_return_import_jobs"("status", "createdAt");

CREATE TABLE "amazon_return_events" (
  "id" BIGSERIAL PRIMARY KEY,
  "fingerprint" VARCHAR(64) NOT NULL,
  "sellerId" VARCHAR(255) NOT NULL,
  "marketplaceId" VARCHAR(50) NOT NULL,
  "fulfilmentType" VARCHAR(10) NOT NULL,
  "reportType" VARCHAR(100) NOT NULL,
  "amazonOrderId" VARCHAR(255) NOT NULL,
  "amazonRmaId" VARCHAR(255),
  "returnDate" TIMESTAMPTZ(3) NOT NULL,
  "sellerSku" VARCHAR(255),
  "asin" VARCHAR(20),
  "fnSku" VARCHAR(255),
  "quantity" INTEGER NOT NULL,
  "amazonStatus" VARCHAR(100),
  "disposition" VARCHAR(100),
  "reason" TEXT,
  "fulfillmentCenterId" VARCHAR(100),
  "licensePlateNumber" VARCHAR(255),
  "customerComments" TEXT,
  "orderId" BIGINT,
  "listingId" BIGINT,
  "productId" BIGINT,
  "inventoryAction" VARCHAR(30) NOT NULL DEFAULT 'REMOTE_ONLY',
  "quantityReceived" INTEGER,
  "qcDisposition" VARCHAR(30),
  "receivedAt" TIMESTAMPTZ(3),
  "processedAt" TIMESTAMPTZ(3),
  "processedByUserId" INTEGER,
  "processedByUserType" VARCHAR(30),
  "rawData" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "amazon_return_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "amazon_marketplace_orders"("id") ON DELETE SET NULL,
  CONSTRAINT "amazon_return_events_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id") ON DELETE SET NULL,
  CONSTRAINT "amazon_return_events_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX "amazon_return_events_fingerprint_key" ON "amazon_return_events"("fingerprint");
CREATE INDEX "amazon_return_events_scope_date_idx" ON "amazon_return_events"("sellerId", "marketplaceId", "returnDate");
CREATE INDEX "amazon_return_events_order_id_idx" ON "amazon_return_events"("amazonOrderId");
CREATE INDEX "amazon_return_events_product_action_idx" ON "amazon_return_events"("productId", "fulfilmentType", "inventoryAction");
