ALTER TABLE "orders"
  ADD COLUMN "order_type" VARCHAR(50),
  ADD COLUMN "created_by_inventory_user_id" INTEGER,
  ADD COLUMN "manual_discount_total" DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN "manual_discount_reason" VARCHAR(500);

ALTER TABLE "orderline"
  ADD COLUMN "manual_discount_amount" DECIMAL(10, 2) DEFAULT 0;

CREATE INDEX "idx_orders_order_type" ON "orders"("order_type");
CREATE INDEX "idx_orders_created_by_inventory_user_id"
  ON "orders"("created_by_inventory_user_id");
