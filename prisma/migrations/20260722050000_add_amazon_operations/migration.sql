CREATE TABLE "amazon_operations_settings" (
    "id" BIGSERIAL NOT NULL,
    "sellerId" VARCHAR(255) NOT NULL,
    "marketplaceId" VARCHAR(50) NOT NULL,
    "productionWritesPaused" BOOLEAN NOT NULL DEFAULT false,
    "pauseReason" TEXT,
    "pausedAt" TIMESTAMPTZ(3),
    "pausedByUserId" INTEGER,
    "pausedByUserType" VARCHAR(30),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "amazon_operations_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "amazon_retry_jobs" (
    "id" BIGSERIAL NOT NULL,
    "sellerId" VARCHAR(255) NOT NULL,
    "marketplaceId" VARCHAR(50) NOT NULL,
    "operation" VARCHAR(50) NOT NULL,
    "resourceType" VARCHAR(50) NOT NULL,
    "resourceId" VARCHAR(255) NOT NULL,
    "payload" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "requestedByUserId" INTEGER,
    "requestedByUserType" VARCHAR(30),
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "amazon_retry_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "amazon_operations_audits" (
    "id" BIGSERIAL NOT NULL,
    "sellerId" VARCHAR(255) NOT NULL,
    "marketplaceId" VARCHAR(50) NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "outcome" VARCHAR(20) NOT NULL,
    "details" JSONB,
    "requestedByUserId" INTEGER,
    "requestedByUserType" VARCHAR(30),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "amazon_operations_audits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "amazon_operations_settings_scope_unique" ON "amazon_operations_settings"("sellerId", "marketplaceId");
CREATE INDEX "amazon_retry_jobs_scope_status_idx" ON "amazon_retry_jobs"("sellerId", "marketplaceId", "status", "nextAttemptAt");
CREATE INDEX "amazon_retry_jobs_resource_idx" ON "amazon_retry_jobs"("resourceType", "resourceId", "createdAt");
CREATE INDEX "amazon_operations_audits_scope_created_idx" ON "amazon_operations_audits"("sellerId", "marketplaceId", "createdAt");
