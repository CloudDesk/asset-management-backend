CREATE TABLE "flipkart_connections" (
    "id" BIGSERIAL NOT NULL,
    "environment" VARCHAR(20) NOT NULL DEFAULT 'PRODUCTION',
    "connectionType" VARCHAR(30) NOT NULL DEFAULT 'SELF_ACCESS',
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL',
    "sellerId" VARCHAR(255),
    "lastAuthenticatedAt" TIMESTAMPTZ(3),
    "tokenExpiresAt" TIMESTAMPTZ(3),
    "lastErrorCode" VARCHAR(100),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "flipkart_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "flipkart_seller_locations" (
    "id" BIGSERIAL NOT NULL,
    "connectionId" BIGINT NOT NULL,
    "externalLocationId" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255),
    "status" VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "lastImportedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "flipkart_seller_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "flipkart_listing_details" (
    "listingId" BIGINT NOT NULL,
    "flipkartListingId" VARCHAR(255) NOT NULL,
    "flipkartProductId" VARCHAR(255) NOT NULL,
    "vertical" VARCHAR(255),
    "mrp" DECIMAL(12,2),
    "sellingPrice" DECIMAL(12,2),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "flipkart_listing_details_pkey" PRIMARY KEY ("listingId")
);

CREATE TABLE "flipkart_listing_locations" (
    "id" BIGSERIAL NOT NULL,
    "listingId" BIGINT NOT NULL,
    "sellerLocationId" BIGINT,
    "externalLocationId" VARCHAR(255) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'UNKNOWN',
    "publishedQuantity" INTEGER,
    "lastImportedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "flipkart_listing_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "flipkart_import_jobs" (
    "id" BIGSERIAL NOT NULL,
    "connectionId" BIGINT,
    "environment" VARCHAR(20) NOT NULL DEFAULT 'MOCK',
    "resourceType" VARCHAR(30) NOT NULL DEFAULT 'LISTINGS',
    "mode" VARCHAR(20) NOT NULL DEFAULT 'MOCK',
    "status" VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "unmapped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "pagesProcessed" INTEGER NOT NULL DEFAULT 0,
    "errorCode" VARCHAR(100),
    "errorMessage" TEXT,
    "requestedByUserId" INTEGER,
    "requestedByUserType" VARCHAR(30),
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "flipkart_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "flipkart_inventory_previews" (
    "id" BIGSERIAL NOT NULL,
    "listingId" BIGINT NOT NULL,
    "listingLocationId" BIGINT,
    "sourceUpdatedAt" TIMESTAMPTZ(3) NOT NULL,
    "remoteQuantity" INTEGER,
    "nivaanaQuantity" INTEGER NOT NULL,
    "safetyBuffer" INTEGER NOT NULL DEFAULT 0,
    "targetQuantity" INTEGER NOT NULL,
    "issues" JSONB NOT NULL,
    "canApply" BOOLEAN NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "requestedByUserId" INTEGER,
    "requestedByUserType" VARCHAR(30),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMPTZ(3),
    CONSTRAINT "flipkart_inventory_previews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "flipkart_inventory_sync_attempts" (
    "id" BIGSERIAL NOT NULL,
    "listingId" BIGINT NOT NULL,
    "previewId" BIGINT,
    "operation" VARCHAR(30) NOT NULL DEFAULT 'INVENTORY',
    "mode" VARCHAR(20) NOT NULL DEFAULT 'DRY_RUN',
    "status" VARCHAR(20) NOT NULL,
    "remoteQuantity" INTEGER,
    "nivaanaQuantity" INTEGER NOT NULL,
    "targetQuantity" INTEGER NOT NULL,
    "requestKey" VARCHAR(64) NOT NULL,
    "externalRequestId" VARCHAR(255),
    "responsePayload" JSONB,
    "errorCode" VARCHAR(100),
    "errorMessage" TEXT,
    "requestedByUserId" INTEGER,
    "requestedByUserType" VARCHAR(30),
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "flipkart_inventory_sync_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "flipkart_connections_environment_type_key" ON "flipkart_connections"("environment", "connectionType");
CREATE INDEX "flipkart_connections_seller_environment_idx" ON "flipkart_connections"("sellerId", "environment");
CREATE UNIQUE INDEX "flipkart_seller_locations_connection_external_key" ON "flipkart_seller_locations"("connectionId", "externalLocationId");
CREATE INDEX "flipkart_seller_locations_connection_status_idx" ON "flipkart_seller_locations"("connectionId", "status");
CREATE UNIQUE INDEX "flipkart_listing_details_external_listing_key" ON "flipkart_listing_details"("flipkartListingId");
CREATE INDEX "flipkart_listing_details_product_idx" ON "flipkart_listing_details"("flipkartProductId");
CREATE UNIQUE INDEX "flipkart_listing_locations_listing_external_key" ON "flipkart_listing_locations"("listingId", "externalLocationId");
CREATE INDEX "flipkart_listing_locations_seller_status_idx" ON "flipkart_listing_locations"("sellerLocationId", "status");
CREATE INDEX "flipkart_import_jobs_resource_status_idx" ON "flipkart_import_jobs"("resourceType", "status", "createdAt");
CREATE INDEX "flipkart_import_jobs_connection_idx" ON "flipkart_import_jobs"("connectionId", "createdAt");
CREATE INDEX "flipkart_inventory_previews_listing_status_idx" ON "flipkart_inventory_previews"("listingId", "status", "expiresAt");
CREATE UNIQUE INDEX "flipkart_inventory_sync_attempts_request_key" ON "flipkart_inventory_sync_attempts"("requestKey");
CREATE INDEX "flipkart_inventory_attempts_listing_idx" ON "flipkart_inventory_sync_attempts"("listingId", "createdAt");
CREATE INDEX "flipkart_inventory_attempts_status_mode_idx" ON "flipkart_inventory_sync_attempts"("status", "mode", "createdAt");

ALTER TABLE "flipkart_seller_locations" ADD CONSTRAINT "flipkart_seller_locations_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "flipkart_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flipkart_listing_details" ADD CONSTRAINT "flipkart_listing_details_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flipkart_listing_locations" ADD CONSTRAINT "flipkart_listing_locations_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "flipkart_listing_details"("listingId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flipkart_listing_locations" ADD CONSTRAINT "flipkart_listing_locations_sellerLocationId_fkey" FOREIGN KEY ("sellerLocationId") REFERENCES "flipkart_seller_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "flipkart_import_jobs" ADD CONSTRAINT "flipkart_import_jobs_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "flipkart_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "flipkart_inventory_previews" ADD CONSTRAINT "flipkart_inventory_previews_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flipkart_inventory_previews" ADD CONSTRAINT "flipkart_inventory_previews_listingLocationId_fkey" FOREIGN KEY ("listingLocationId") REFERENCES "flipkart_listing_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "flipkart_inventory_sync_attempts" ADD CONSTRAINT "flipkart_inventory_sync_attempts_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "flipkart_inventory_sync_attempts" ADD CONSTRAINT "flipkart_inventory_sync_attempts_previewId_fkey" FOREIGN KEY ("previewId") REFERENCES "flipkart_inventory_previews"("id") ON DELETE SET NULL ON UPDATE CASCADE;
