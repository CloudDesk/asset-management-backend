ALTER TABLE "amazon_order_fulfillment_exceptions"
ADD COLUMN "retryPayload" JSONB,
ADD COLUMN "resolutionNote" TEXT,
ADD COLUMN "resolvedByUserId" INTEGER,
ADD COLUMN "resolvedByUserType" VARCHAR(30);
