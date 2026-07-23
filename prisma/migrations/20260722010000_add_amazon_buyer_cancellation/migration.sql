ALTER TABLE "amazon_marketplace_orders"
ADD COLUMN "buyerRequestedCancellation" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "amazon_marketplace_order_items"
ADD COLUMN "cancellationRequester" VARCHAR(30),
ADD COLUMN "buyerCancelReason" TEXT;
