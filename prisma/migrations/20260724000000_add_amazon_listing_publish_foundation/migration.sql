CREATE TABLE "amazon_listing_publish_drafts" (
  "id" BIGSERIAL PRIMARY KEY,
  "productId" BIGINT NOT NULL,
  "marketplace" VARCHAR(30) NOT NULL DEFAULT 'AMAZON',
  "environment" VARCHAR(20) NOT NULL DEFAULT 'PRODUCTION',
  "sellerId" VARCHAR(255) NOT NULL,
  "marketplaceId" VARCHAR(50) NOT NULL,
  "activeDraftKey" VARCHAR(600),
  "listingMode" VARCHAR(30) NOT NULL DEFAULT 'UNDECIDED',
  "sellerSku" VARCHAR(255),
  "asin" VARCHAR(20),
  "productType" VARCHAR(255),
  "requirements" VARCHAR(40),
  "fulfilmentChannel" VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
  "status" VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
  "lastValidationStatus" VARCHAR(40),
  "lastSubmissionStatus" VARCHAR(40),
  "draftRevision" INTEGER NOT NULL DEFAULT 1,
  "sourceProductModifiedAt" BIGINT,
  "sourceSnapshot" JSONB NOT NULL,
  "candidateResults" JSONB NOT NULL,
  "mappedAttributes" JSONB NOT NULL,
  "schemaVersion" VARCHAR(100),
  "schemaChecksum" VARCHAR(128),
  "validatedPayloadHash" VARCHAR(128),
  "approvedByUserId" INTEGER,
  "approvedByUserType" VARCHAR(30),
  "createdByUserId" INTEGER,
  "createdByUserType" VARCHAR(30),
  "cancelledByUserId" INTEGER,
  "cancelledByUserType" VARCHAR(30),
  "cancelledAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "amazon_listing_publish_drafts_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "amazon_publish_drafts_active_key_unique"
  ON "amazon_listing_publish_drafts"("activeDraftKey");
CREATE INDEX "amazon_publish_drafts_product_scope_status_idx"
  ON "amazon_listing_publish_drafts"("productId", "sellerId", "marketplaceId", "status");
CREATE INDEX "amazon_publish_drafts_scope_status_updated_idx"
  ON "amazon_listing_publish_drafts"("sellerId", "marketplaceId", "status", "updatedAt");
CREATE INDEX "amazon_publish_drafts_sku_scope_idx"
  ON "amazon_listing_publish_drafts"("sellerSku", "sellerId", "marketplaceId");

CREATE TABLE "amazon_listing_publish_attempts" (
  "id" BIGSERIAL PRIMARY KEY,
  "draftId" BIGINT NOT NULL,
  "operation" VARCHAR(30) NOT NULL,
  "status" VARCHAR(40) NOT NULL,
  "requestKey" VARCHAR(128) NOT NULL,
  "draftRevision" INTEGER NOT NULL,
  "payloadHash" VARCHAR(128) NOT NULL,
  "requestPayload" JSONB NOT NULL,
  "responsePayload" JSONB,
  "amazonSubmissionId" VARCHAR(255),
  "amazonStatus" VARCHAR(40),
  "issues" JSONB NOT NULL,
  "httpStatus" INTEGER,
  "errorCode" VARCHAR(100),
  "errorMessage" TEXT,
  "requestedByUserId" INTEGER,
  "requestedByUserType" VARCHAR(30),
  "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "amazon_listing_publish_attempts_draftId_fkey"
    FOREIGN KEY ("draftId") REFERENCES "amazon_listing_publish_drafts"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "amazon_publish_attempts_request_key_unique"
  ON "amazon_listing_publish_attempts"("requestKey");
CREATE INDEX "amazon_publish_attempts_draft_created_idx"
  ON "amazon_listing_publish_attempts"("draftId", "createdAt");
CREATE INDEX "amazon_publish_attempts_status_created_idx"
  ON "amazon_listing_publish_attempts"("status", "createdAt");

CREATE TABLE "amazon_listing_publish_audits" (
  "id" BIGSERIAL PRIMARY KEY,
  "draftId" BIGINT NOT NULL,
  "productId" BIGINT NOT NULL,
  "sellerId" VARCHAR(255) NOT NULL,
  "marketplaceId" VARCHAR(50) NOT NULL,
  "sellerSku" VARCHAR(255),
  "asin" VARCHAR(20),
  "operation" VARCHAR(60) NOT NULL,
  "beforeValues" JSONB,
  "afterValues" JSONB,
  "metadata" JSONB,
  "requestedByUserId" INTEGER,
  "requestedByUserType" VARCHAR(30),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "amazon_listing_publish_audits_draftId_fkey"
    FOREIGN KEY ("draftId") REFERENCES "amazon_listing_publish_drafts"("id") ON DELETE CASCADE
);

CREATE INDEX "amazon_publish_audits_draft_created_idx"
  ON "amazon_listing_publish_audits"("draftId", "createdAt");
CREATE INDEX "amazon_publish_audits_scope_created_idx"
  ON "amazon_listing_publish_audits"("sellerId", "marketplaceId", "createdAt");

CREATE TABLE "amazon_product_type_schema_cache" (
  "id" BIGSERIAL PRIMARY KEY,
  "cacheKey" VARCHAR(700) NOT NULL,
  "sellerId" VARCHAR(255),
  "marketplaceId" VARCHAR(50) NOT NULL,
  "productType" VARCHAR(255) NOT NULL,
  "requirements" VARCHAR(40) NOT NULL,
  "requirementsEnforced" VARCHAR(30) NOT NULL DEFAULT 'ENFORCED',
  "locale" VARCHAR(20) NOT NULL DEFAULT 'DEFAULT',
  "productTypeVersion" VARCHAR(100) NOT NULL DEFAULT 'LATEST',
  "resolvedVersion" VARCHAR(100),
  "schemaChecksum" VARCHAR(128) NOT NULL,
  "definitionSchema" JSONB NOT NULL,
  "propertyGroups" JSONB,
  "fetchedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "amazon_product_type_schema_cache_key_unique"
  ON "amazon_product_type_schema_cache"("cacheKey");
CREATE INDEX "amazon_product_type_schema_lookup_idx"
  ON "amazon_product_type_schema_cache"("marketplaceId", "productType", "requirements", "expiresAt");
