ALTER TABLE "marketplace_listings"
ADD COLUMN "inventorySyncMode" VARCHAR(20) NOT NULL DEFAULT 'DISABLED',
ADD COLUMN "lastInventorySyncAt" TIMESTAMPTZ(3),
ADD COLUMN "lastInventorySyncStatus" VARCHAR(20),
ADD COLUMN "lastSyncedQuantity" INTEGER;

CREATE TABLE "amazon_inventory_sync_attempts" (
    "id" BIGSERIAL NOT NULL,
    "listingId" BIGINT NOT NULL,
    "operation" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "amazonQuantity" INTEGER,
    "nivaanaQuantity" INTEGER NOT NULL,
    "targetQuantity" INTEGER NOT NULL,
    "requestKey" VARCHAR(64) NOT NULL,
    "previewId" BIGINT,
    "amazonSubmissionId" VARCHAR(255),
    "errorCode" VARCHAR(100),
    "errorMessage" TEXT,
    "requestedByUserId" INTEGER,
    "requestedByUserType" VARCHAR(30),
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "amazon_inventory_sync_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "amazon_inventory_sync_attempts_requestKey_key"
ON "amazon_inventory_sync_attempts"("requestKey");

CREATE UNIQUE INDEX "amazon_inventory_sync_attempts_previewId_key"
ON "amazon_inventory_sync_attempts"("previewId");

CREATE INDEX "amazon_inventory_sync_attempts_listing_idx"
ON "amazon_inventory_sync_attempts"("listingId", "createdAt");

CREATE INDEX "amazon_inventory_sync_attempts_status_idx"
ON "amazon_inventory_sync_attempts"("status", "createdAt");

ALTER TABLE "amazon_inventory_sync_attempts"
ADD CONSTRAINT "amazon_inventory_sync_attempts_listingId_fkey"
FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
