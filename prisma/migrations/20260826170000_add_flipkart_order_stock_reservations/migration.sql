CREATE TABLE "flipkart_order_stock_reservations" (
  "id" BIGSERIAL PRIMARY KEY,
  "shipmentId" BIGINT NOT NULL,
  "orderItemId" VARCHAR(255) NOT NULL,
  "productId" BIGINT NOT NULL,
  "listingId" BIGINT,
  "platformStockId" BIGINT,
  "quantity" INTEGER NOT NULL,
  "status" VARCHAR(30) NOT NULL,
  "errorMessage" TEXT,
  "reservedAt" TIMESTAMPTZ(3),
  "releasedAt" TIMESTAMPTZ(3),
  "soldAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "flipkart_order_stock_reservations_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "flipkart_shipments"("id") ON DELETE CASCADE,
  CONSTRAINT "flipkart_order_stock_reservations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT,
  CONSTRAINT "flipkart_order_stock_reservations_platformStockId_fkey" FOREIGN KEY ("platformStockId") REFERENCES "platformstock"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "flipkart_order_stock_reservations_item_unique" ON "flipkart_order_stock_reservations"("shipmentId", "orderItemId");
CREATE INDEX "flipkart_order_stock_reservations_product_idx" ON "flipkart_order_stock_reservations"("productId", "status");
CREATE INDEX "flipkart_order_stock_reservations_stock_idx" ON "flipkart_order_stock_reservations"("platformStockId", "status");
