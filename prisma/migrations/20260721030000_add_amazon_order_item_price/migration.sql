ALTER TABLE "amazon_marketplace_order_items"
ADD COLUMN "unitPrice" DECIMAL(12, 2),
ADD COLUMN "currency" VARCHAR(10);
