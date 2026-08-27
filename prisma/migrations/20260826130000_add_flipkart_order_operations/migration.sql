CREATE TABLE "flipkart_order_import_jobs" (
  "id" BIGSERIAL PRIMARY KEY,
  "environment" VARCHAR(20) NOT NULL DEFAULT 'MOCK',
  "mode" VARCHAR(20) NOT NULL DEFAULT 'MOCK',
  "trigger" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
  "status" VARCHAR(20) NOT NULL,
  "fetched" INTEGER NOT NULL DEFAULT 0,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "unmapped" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "requestedByUserId" INTEGER,
  "requestedByUserType" VARCHAR(30),
  "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "flipkart_order_import_jobs_status_idx" ON "flipkart_order_import_jobs"("environment", "status", "createdAt");

CREATE TABLE "flipkart_shipments" (
  "id" BIGSERIAL PRIMARY KEY,
  "environment" VARCHAR(20) NOT NULL DEFAULT 'MOCK',
  "sellerId" VARCHAR(255) NOT NULL,
  "shipmentId" VARCHAR(255) NOT NULL,
  "orderId" VARCHAR(255) NOT NULL,
  "locationId" VARCHAR(255) NOT NULL,
  "fulfilmentType" VARCHAR(30) NOT NULL,
  "shipmentStatus" VARCHAR(40) NOT NULL,
  "workflowStatus" VARCHAR(40) NOT NULL,
  "syncState" VARCHAR(30) NOT NULL,
  "hold" BOOLEAN NOT NULL DEFAULT false,
  "buyerName" VARCHAR(255),
  "buyerAddress" JSONB,
  "orderDate" TIMESTAMPTZ(3) NOT NULL,
  "dispatchAfterDate" TIMESTAMPTZ(3),
  "dispatchByDate" TIMESTAMPTZ(3),
  "invoiceNumber" VARCHAR(255),
  "invoiceDate" TIMESTAMPTZ(3),
  "deliveryPartner" VARCHAR(255),
  "deliveryPartnerCode" VARCHAR(100),
  "trackingId" VARCHAR(255),
  "tentativeDeliveryDate" TIMESTAMPTZ(3),
  "deliveredAt" TIMESTAMPTZ(3),
  "lastError" TEXT,
  "lastImportedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "flipkart_shipments_unique" ON "flipkart_shipments"("environment", "sellerId", "shipmentId");
CREATE INDEX "flipkart_shipments_status_idx" ON "flipkart_shipments"("sellerId", "shipmentStatus", "orderDate");
CREATE INDEX "flipkart_shipments_order_id_idx" ON "flipkart_shipments"("orderId");

CREATE TABLE "flipkart_shipment_items" (
  "id" BIGSERIAL PRIMARY KEY,
  "shipmentId" BIGINT NOT NULL,
  "orderItemId" VARCHAR(255) NOT NULL,
  "sellerSku" VARCHAR(255) NOT NULL,
  "listingId" BIGINT,
  "productId" BIGINT,
  "flipkartListingId" VARCHAR(255),
  "fsn" VARCHAR(255),
  "title" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitsPerListing" INTEGER NOT NULL DEFAULT 1,
  "sellingPrice" DECIMAL(12,2),
  "currency" VARCHAR(10),
  "mappingStatus" VARCHAR(20) NOT NULL DEFAULT 'UNMAPPED',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "flipkart_shipment_items_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "flipkart_shipments"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "flipkart_shipment_items_unique" ON "flipkart_shipment_items"("shipmentId", "orderItemId");
CREATE INDEX "flipkart_shipment_items_listing_idx" ON "flipkart_shipment_items"("listingId");
CREATE INDEX "flipkart_shipment_items_product_idx" ON "flipkart_shipment_items"("productId");

CREATE TABLE "flipkart_fulfillment_actions" (
  "id" BIGSERIAL PRIMARY KEY,
  "shipmentId" BIGINT NOT NULL,
  "action" VARCHAR(50) NOT NULL,
  "fromStatus" VARCHAR(40),
  "toStatus" VARCHAR(40),
  "mode" VARCHAR(20) NOT NULL DEFAULT 'DRY_RUN',
  "outcome" VARCHAR(20) NOT NULL,
  "requestPayload" JSONB,
  "responsePayload" JSONB,
  "externalRequestId" VARCHAR(255),
  "errorCode" VARCHAR(100),
  "errorMessage" TEXT,
  "requestedByUserId" INTEGER,
  "requestedByUserType" VARCHAR(30),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "flipkart_fulfillment_actions_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "flipkart_shipments"("id") ON DELETE CASCADE
);
CREATE INDEX "flipkart_fulfillment_actions_shipment_idx" ON "flipkart_fulfillment_actions"("shipmentId", "createdAt");
CREATE INDEX "flipkart_fulfillment_actions_outcome_idx" ON "flipkart_fulfillment_actions"("outcome", "createdAt");

CREATE TABLE "flipkart_tracking_events" (
  "id" BIGSERIAL PRIMARY KEY,
  "shipmentId" BIGINT NOT NULL,
  "eventCode" VARCHAR(50) NOT NULL,
  "status" VARCHAR(50) NOT NULL,
  "description" TEXT,
  "location" VARCHAR(255),
  "source" VARCHAR(40) NOT NULL DEFAULT 'FLIPKART_MOCK',
  "externalEventId" VARCHAR(255),
  "eventTime" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "flipkart_tracking_events_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "flipkart_shipments"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "flipkart_tracking_events_externalEventId_key" ON "flipkart_tracking_events"("externalEventId");
CREATE INDEX "flipkart_tracking_events_shipment_idx" ON "flipkart_tracking_events"("shipmentId", "eventTime");
