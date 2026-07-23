ALTER TABLE "amazon_marketplace_orders"
ADD COLUMN "shipByStart" TIMESTAMPTZ(3),
ADD COLUMN "shipByEnd" TIMESTAMPTZ(3);

CREATE TABLE "amazon_order_fulfillments" (
  "id" BIGSERIAL PRIMARY KEY,
  "orderId" BIGINT NOT NULL UNIQUE,
  "route" VARCHAR(40) NOT NULL,
  "workflowStatus" VARCHAR(40) NOT NULL,
  "pickTaskReference" VARCHAR(100) UNIQUE,
  "pickedAt" TIMESTAMPTZ(3),
  "packedAt" TIMESTAMPTZ(3),
  "packageWeightGrams" INTEGER,
  "packageLengthCm" DECIMAL(10,2),
  "packageWidthCm" DECIMAL(10,2),
  "packageHeightCm" DECIMAL(10,2),
  "packageIdentifier" VARCHAR(255),
  "shippingMethod" VARCHAR(100),
  "logisticsPartner" VARCHAR(100),
  "courierCode" VARCHAR(100),
  "courierName" VARCHAR(255),
  "trackingNumber" VARCHAR(255),
  "shippingDate" TIMESTAMPTZ(3),
  "invoiceUrl" TEXT,
  "packingSlipUrl" TEXT,
  "shippingLabelUrl" TEXT,
  "easyShipPackageId" VARCHAR(255),
  "easyShipSlotId" VARCHAR(255),
  "easyShipSlotStart" TIMESTAMPTZ(3),
  "easyShipSlotEnd" TIMESTAMPTZ(3),
  "easyShipHandoverMethod" VARCHAR(20),
  "easyShipStatus" VARCHAR(50),
  "amazonConfirmationStatus" VARCHAR(30) NOT NULL DEFAULT 'NOT_REQUIRED',
  "amazonConfirmedAt" TIMESTAMPTZ(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "amazon_order_fulfillments_order_fk" FOREIGN KEY ("orderId") REFERENCES "amazon_marketplace_orders"("id") ON DELETE CASCADE
);

CREATE INDEX "amazon_order_fulfillment_route_status_idx" ON "amazon_order_fulfillments"("route", "workflowStatus");

CREATE TABLE "amazon_order_fulfillment_audits" (
  "id" BIGSERIAL PRIMARY KEY,
  "orderId" BIGINT NOT NULL,
  "fulfillmentId" BIGINT,
  "action" VARCHAR(50) NOT NULL,
  "fromStatus" VARCHAR(40),
  "toStatus" VARCHAR(40),
  "outcome" VARCHAR(20) NOT NULL,
  "details" JSONB,
  "actorUserId" INTEGER,
  "actorUserType" VARCHAR(30),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "amazon_order_fulfillment_audits_order_fk" FOREIGN KEY ("orderId") REFERENCES "amazon_marketplace_orders"("id") ON DELETE CASCADE,
  CONSTRAINT "amazon_order_fulfillment_audits_fulfillment_fk" FOREIGN KEY ("fulfillmentId") REFERENCES "amazon_order_fulfillments"("id") ON DELETE SET NULL
);

CREATE INDEX "amazon_order_fulfillment_audit_order_created_idx" ON "amazon_order_fulfillment_audits"("orderId", "createdAt");

CREATE TABLE "amazon_order_fulfillment_exceptions" (
  "id" BIGSERIAL PRIMARY KEY,
  "orderId" BIGINT NOT NULL,
  "fulfillmentId" BIGINT,
  "action" VARCHAR(50) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  "errorCode" VARCHAR(100) NOT NULL,
  "message" TEXT NOT NULL,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "lastRetriedAt" TIMESTAMPTZ(3),
  "resolvedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "amazon_order_fulfillment_exceptions_order_fk" FOREIGN KEY ("orderId") REFERENCES "amazon_marketplace_orders"("id") ON DELETE CASCADE,
  CONSTRAINT "amazon_order_fulfillment_exceptions_fulfillment_fk" FOREIGN KEY ("fulfillmentId") REFERENCES "amazon_order_fulfillments"("id") ON DELETE SET NULL
);

CREATE INDEX "amazon_order_fulfillment_exception_status_idx" ON "amazon_order_fulfillment_exceptions"("status", "createdAt");
CREATE INDEX "amazon_order_fulfillment_exception_order_idx" ON "amazon_order_fulfillment_exceptions"("orderId", "status");
