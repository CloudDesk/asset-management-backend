ALTER TABLE "marketplace_listings"
ADD COLUMN "pendingOfferPrice" DECIMAL(12,2),
ADD COLUMN "pendingOfferQuantity" INTEGER,
ADD COLUMN "pendingHandlingTimeDays" INTEGER,
ADD COLUMN "lastOfferUpdateAt" TIMESTAMPTZ(3),
ADD COLUMN "lastOfferUpdateStatus" VARCHAR(30),
ADD COLUMN "lastOfferSubmissionId" VARCHAR(255);

CREATE TABLE "amazon_offer_update_previews" (
  "id" BIGSERIAL PRIMARY KEY,
  "listingId" BIGINT NOT NULL,
  "sourceUpdatedAt" TIMESTAMPTZ(3) NOT NULL,
  "requestedChanges" JSONB NOT NULL,
  "amazonIssues" JSONB NOT NULL,
  "canApply" BOOLEAN NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "requestedByUserId" INTEGER,
  "requestedByUserType" VARCHAR(30),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumedAt" TIMESTAMPTZ(3),
  CONSTRAINT "amazon_offer_update_previews_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE
);

CREATE INDEX "amazon_offer_preview_listing_status_idx" ON "amazon_offer_update_previews"("listingId", "status", "expiresAt");
