CREATE TABLE "marketplace_listings" (
    "id" BIGSERIAL NOT NULL,
    "marketplace" VARCHAR(30) NOT NULL DEFAULT 'AMAZON',
    "environment" VARCHAR(20) NOT NULL DEFAULT 'PRODUCTION',
    "marketplaceId" VARCHAR(50) NOT NULL,
    "sellerId" VARCHAR(255) NOT NULL,
    "sellerSku" VARCHAR(255) NOT NULL,
    "asin" VARCHAR(20),
    "fnSku" VARCHAR(255),
    "title" TEXT,
    "productType" VARCHAR(255),
    "listingStatus" VARCHAR(255) NOT NULL DEFAULT 'UNKNOWN',
    "originalFulfilmentValue" VARCHAR(255),
    "fulfilmentChannel" VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
    "publishedQuantity" INTEGER,
    "price" DECIMAL(12,2),
    "currency" VARCHAR(10),
    "amazonLastUpdatedAt" TIMESTAMPTZ(3),
    "productId" BIGINT,
    "mappingStatus" VARCHAR(20) NOT NULL DEFAULT 'UNMAPPED',
    "unitsPerListing" INTEGER NOT NULL DEFAULT 1,
    "mappedAt" TIMESTAMPTZ(3),
    "lastImportedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "channel_sync_logs" (
    "id" BIGSERIAL NOT NULL,
    "marketplace" VARCHAR(30) NOT NULL,
    "environment" VARCHAR(20) NOT NULL,
    "operation" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "marketplaceId" VARCHAR(50) NOT NULL,
    "sellerId" VARCHAR(255) NOT NULL,
    "totalFetched" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "unmapped" INTEGER NOT NULL DEFAULT 0,
    "conflicts" INTEGER NOT NULL DEFAULT 0,
    "inactive" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "errorCode" VARCHAR(100),
    "errorMessage" TEXT,
    "requestedByUserId" INTEGER,
    "requestedByUserType" VARCHAR(30),
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_sync_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "marketplace_listing_seller_sku_key"
    ON "marketplace_listings"("marketplace", "marketplaceId", "sellerId", "sellerSku");

CREATE INDEX "marketplace_listings_product_id_idx"
    ON "marketplace_listings"("productId");

CREATE INDEX "marketplace_listings_mapping_status_idx"
    ON "marketplace_listings"("marketplace", "marketplaceId", "sellerId", "mappingStatus");

CREATE INDEX "marketplace_listings_fulfilment_idx"
    ON "marketplace_listings"("marketplace", "marketplaceId", "sellerId", "fulfilmentChannel");

CREATE INDEX "marketplace_listings_status_idx"
    ON "marketplace_listings"("marketplace", "marketplaceId", "sellerId", "listingStatus");

CREATE INDEX "channel_sync_logs_lookup_idx"
    ON "channel_sync_logs"("marketplace", "environment", "operation", "startedAt");

CREATE INDEX "channel_sync_logs_seller_idx"
    ON "channel_sync_logs"("sellerId", "marketplaceId", "startedAt");

ALTER TABLE "marketplace_listings"
    ADD CONSTRAINT "marketplace_listings_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "product"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
