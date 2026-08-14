CREATE TABLE "marketplace_listing_audits" (
    "id" BIGSERIAL NOT NULL,
    "listingId" BIGINT,
    "syncLogId" BIGINT,
    "marketplace" VARCHAR(30) NOT NULL DEFAULT 'AMAZON',
    "environment" VARCHAR(20) NOT NULL DEFAULT 'PRODUCTION',
    "marketplaceId" VARCHAR(50) NOT NULL,
    "sellerId" VARCHAR(255) NOT NULL,
    "sellerSku" VARCHAR(255) NOT NULL,
    "operation" VARCHAR(50) NOT NULL,
    "changedFields" JSONB NOT NULL,
    "beforeValues" JSONB,
    "afterValues" JSONB,
    "previousProductId" BIGINT,
    "productId" BIGINT,
    "requestedByUserId" INTEGER,
    "requestedByUserType" VARCHAR(30),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_listing_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "marketplace_listing_audits_listing_idx"
    ON "marketplace_listing_audits"("listingId", "createdAt");

CREATE INDEX "marketplace_listing_audits_sync_log_idx"
    ON "marketplace_listing_audits"("syncLogId");

CREATE INDEX "marketplace_listing_audits_lookup_idx"
    ON "marketplace_listing_audits"("marketplace", "marketplaceId", "sellerId", "createdAt");

ALTER TABLE "marketplace_listing_audits"
    ADD CONSTRAINT "marketplace_listing_audits_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "marketplace_listing_audits"
    ADD CONSTRAINT "marketplace_listing_audits_syncLogId_fkey"
    FOREIGN KEY ("syncLogId") REFERENCES "channel_sync_logs"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
