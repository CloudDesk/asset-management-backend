ALTER TABLE "marketplace_listings"
ADD COLUMN "fbaFulfillableQuantity" INTEGER,
ADD COLUMN "fbaReservedQuantity" INTEGER,
ADD COLUMN "fbaPendingOrderQuantity" INTEGER,
ADD COLUMN "fbaTotalQuantity" INTEGER;

ALTER TABLE "amazon_order_stock_reservations"
ADD COLUMN "listingId" BIGINT,
ADD COLUMN "inventoryOwnership" VARCHAR(30) NOT NULL DEFAULT 'SELLER';

ALTER TABLE "amazon_order_stock_reservations"
ADD CONSTRAINT "amazon_order_stock_reservations_listingId_fkey"
FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "amazon_order_stock_reservations_listing_owner_status_idx"
ON "amazon_order_stock_reservations"("listingId", "inventoryOwnership", "status");
