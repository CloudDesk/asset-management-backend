ALTER TABLE "amazon_order_stock_reservations"
ADD COLUMN "soldAt" TIMESTAMPTZ(3);

CREATE INDEX "amazon_order_stock_reservations_status_sold_idx"
ON "amazon_order_stock_reservations"("status", "soldAt");
