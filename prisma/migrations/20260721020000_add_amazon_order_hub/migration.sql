CREATE TABLE "amazon_marketplace_orders" (
    "id" BIGSERIAL NOT NULL,
    "sellerId" VARCHAR(255) NOT NULL,
    "marketplaceId" VARCHAR(50) NOT NULL,
    "amazonOrderId" VARCHAR(255) NOT NULL,
    "purchaseDate" TIMESTAMPTZ(3) NOT NULL,
    "lastUpdateDate" TIMESTAMPTZ(3) NOT NULL,
    "orderStatus" VARCHAR(50) NOT NULL,
    "fulfilmentType" VARCHAR(30) NOT NULL,
    "fulfilmentRoute" VARCHAR(40) NOT NULL,
    "syncState" VARCHAR(30) NOT NULL,
    "hasUnmappedItems" BOOLEAN NOT NULL DEFAULT false,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "programs" JSONB,
    "lastImportedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "amazon_marketplace_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "amazon_marketplace_order_items" (
    "id" BIGSERIAL NOT NULL,
    "orderId" BIGINT NOT NULL,
    "amazonOrderItemId" VARCHAR(255) NOT NULL,
    "sellerSku" VARCHAR(255),
    "asin" VARCHAR(20),
    "title" TEXT,
    "quantityOrdered" INTEGER NOT NULL DEFAULT 0,
    "quantityShipped" INTEGER NOT NULL DEFAULT 0,
    "listingId" BIGINT,
    "productId" BIGINT,
    "unitsPerListing" INTEGER NOT NULL DEFAULT 1,
    "mappingStatus" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "amazon_marketplace_order_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "amazon_marketplace_orders_unique" ON "amazon_marketplace_orders"("sellerId", "marketplaceId", "amazonOrderId");
CREATE INDEX "amazon_marketplace_orders_purchase_idx" ON "amazon_marketplace_orders"("sellerId", "marketplaceId", "purchaseDate");
CREATE INDEX "amazon_marketplace_orders_sync_idx" ON "amazon_marketplace_orders"("sellerId", "marketplaceId", "syncState");
CREATE UNIQUE INDEX "amazon_marketplace_order_items_unique" ON "amazon_marketplace_order_items"("orderId", "amazonOrderItemId");
CREATE INDEX "amazon_marketplace_order_items_listing_idx" ON "amazon_marketplace_order_items"("listingId");
CREATE INDEX "amazon_marketplace_order_items_product_idx" ON "amazon_marketplace_order_items"("productId");

ALTER TABLE "amazon_marketplace_order_items" ADD CONSTRAINT "amazon_marketplace_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "amazon_marketplace_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "amazon_marketplace_order_items" ADD CONSTRAINT "amazon_marketplace_order_items_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "amazon_marketplace_order_items" ADD CONSTRAINT "amazon_marketplace_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
