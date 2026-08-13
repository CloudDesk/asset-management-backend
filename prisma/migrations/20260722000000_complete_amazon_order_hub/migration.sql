CREATE TABLE "amazon_order_route_handoffs" (
    "id" BIGSERIAL NOT NULL,
    "orderId" BIGINT NOT NULL,
    "route" VARCHAR(40) NOT NULL,
    "status" VARCHAR(40) NOT NULL,
    "blockedReason" TEXT,
    "lastEvaluatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "amazon_order_route_handoffs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "amazon_order_stock_reservations" (
    "id" BIGSERIAL NOT NULL,
    "orderId" BIGINT NOT NULL,
    "amazonOrderItemId" VARCHAR(255) NOT NULL,
    "productId" BIGINT NOT NULL,
    "platformStockId" BIGINT,
    "quantity" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "errorMessage" TEXT,
    "reservedAt" TIMESTAMPTZ(3),
    "releasedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "amazon_order_stock_reservations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "amazon_order_import_jobs" (
    "id" BIGSERIAL NOT NULL,
    "sellerId" VARCHAR(255) NOT NULL,
    "marketplaceId" VARCHAR(50) NOT NULL,
    "mode" VARCHAR(20) NOT NULL,
    "trigger" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "activeKey" VARCHAR(350),
    "fetched" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "unmapped" INTEGER NOT NULL DEFAULT 0,
    "cancelled" INTEGER NOT NULL DEFAULT 0,
    "pagesProcessed" INTEGER NOT NULL DEFAULT 0,
    "searchStart" TIMESTAMPTZ(3),
    "errorMessage" TEXT,
    "requestedByUserId" INTEGER,
    "requestedByUserType" VARCHAR(30),
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "amazon_order_import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "amazon_order_notifications" (
    "id" BIGSERIAL NOT NULL,
    "notificationId" VARCHAR(255) NOT NULL,
    "notificationType" VARCHAR(100) NOT NULL,
    "sellerId" VARCHAR(255) NOT NULL,
    "marketplaceId" VARCHAR(50) NOT NULL,
    "eventTime" TIMESTAMPTZ(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "jobId" BIGINT,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "amazon_order_notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "amazon_order_route_handoffs_orderId_key" ON "amazon_order_route_handoffs"("orderId");
CREATE INDEX "amazon_order_route_handoffs_route_status_idx" ON "amazon_order_route_handoffs"("route", "status");
CREATE UNIQUE INDEX "amazon_order_stock_reservations_order_item_unique" ON "amazon_order_stock_reservations"("orderId", "amazonOrderItemId");
CREATE INDEX "amazon_order_stock_reservations_product_status_idx" ON "amazon_order_stock_reservations"("productId", "status");
CREATE UNIQUE INDEX "amazon_order_import_jobs_activeKey_key" ON "amazon_order_import_jobs"("activeKey");
CREATE INDEX "amazon_order_import_jobs_scope_created_idx" ON "amazon_order_import_jobs"("sellerId", "marketplaceId", "createdAt");
CREATE INDEX "amazon_order_import_jobs_status_created_idx" ON "amazon_order_import_jobs"("status", "createdAt");
CREATE UNIQUE INDEX "amazon_order_notifications_notificationId_key" ON "amazon_order_notifications"("notificationId");
CREATE INDEX "amazon_order_notifications_scope_event_idx" ON "amazon_order_notifications"("sellerId", "marketplaceId", "eventTime");
CREATE INDEX "amazon_order_notifications_status_created_idx" ON "amazon_order_notifications"("status", "createdAt");

ALTER TABLE "amazon_order_route_handoffs" ADD CONSTRAINT "amazon_order_route_handoffs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "amazon_marketplace_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "amazon_order_stock_reservations" ADD CONSTRAINT "amazon_order_stock_reservations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "amazon_marketplace_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "amazon_order_stock_reservations" ADD CONSTRAINT "amazon_order_stock_reservations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "amazon_order_stock_reservations" ADD CONSTRAINT "amazon_order_stock_reservations_platformStockId_fkey" FOREIGN KEY ("platformStockId") REFERENCES "platformstock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "amazon_order_notifications" ADD CONSTRAINT "amazon_order_notifications_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "amazon_order_import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
