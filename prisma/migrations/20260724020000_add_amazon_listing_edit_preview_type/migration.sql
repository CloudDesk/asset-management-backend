ALTER TABLE "amazon_offer_update_previews"
  ADD COLUMN "operationType" VARCHAR(30) NOT NULL DEFAULT 'OFFER';

CREATE INDEX "amazon_offer_preview_listing_operation_status_idx"
  ON "amazon_offer_update_previews"("listingId", "operationType", "status", "expiresAt");
