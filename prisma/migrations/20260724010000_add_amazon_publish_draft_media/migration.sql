CREATE TABLE "amazon_listing_publish_images" (
  "id" BIGSERIAL PRIMARY KEY,
  "draftId" BIGINT NOT NULL,
  "sourceType" VARCHAR(30) NOT NULL,
  "sourceProductUrl" TEXT,
  "url" TEXT NOT NULL,
  "originalFileName" VARCHAR(500),
  "contentType" VARCHAR(100),
  "sizeBytes" INTEGER,
  "width" INTEGER,
  "height" INTEGER,
  "sortOrder" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  "accessibilityStatus" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "accessibilityError" TEXT,
  "accessibilityCheckedAt" TIMESTAMPTZ(3),
  "validationErrors" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdByUserId" INTEGER,
  "createdByUserType" VARCHAR(30),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "amazon_listing_publish_images_draftId_fkey"
    FOREIGN KEY ("draftId") REFERENCES "amazon_listing_publish_drafts"("id") ON DELETE CASCADE
);

CREATE INDEX "amazon_publish_images_draft_status_order_idx"
  ON "amazon_listing_publish_images"("draftId", "status", "sortOrder");
