CREATE TABLE "amazon_api_telemetry" (
    "id" BIGSERIAL NOT NULL,
    "sellerId" VARCHAR(255) NOT NULL,
    "marketplaceId" VARCHAR(50) NOT NULL,
    "operation" VARCHAR(120) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "rateLimit" VARCHAR(100),
    "requestId" VARCHAR(255),
    "retryAfter" VARCHAR(100),
    "throttled" BOOLEAN NOT NULL DEFAULT false,
    "successful" BOOLEAN NOT NULL DEFAULT false,
    "observedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "amazon_api_telemetry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "amazon_notification_subscriptions" (
    "id" BIGSERIAL NOT NULL,
    "sellerId" VARCHAR(255) NOT NULL,
    "marketplaceId" VARCHAR(50) NOT NULL,
    "notificationType" VARCHAR(100) NOT NULL,
    "payloadVersion" VARCHAR(30) NOT NULL,
    "destinationKind" VARCHAR(30) NOT NULL,
    "destinationId" VARCHAR(255),
    "amazonSubscriptionId" VARCHAR(255),
    "status" VARCHAR(30) NOT NULL DEFAULT 'NOT_CONFIGURED',
    "lastError" TEXT,
    "lastCheckedAt" TIMESTAMPTZ(3),
    "configuredAt" TIMESTAMPTZ(3),
    "configuredByUserId" INTEGER,
    "configuredByUserType" VARCHAR(30),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "amazon_notification_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "amazon_api_telemetry_scope_operation_unique" ON "amazon_api_telemetry"("sellerId", "marketplaceId", "operation");
CREATE INDEX "amazon_api_telemetry_scope_observed_idx" ON "amazon_api_telemetry"("sellerId", "marketplaceId", "observedAt");
CREATE INDEX "amazon_api_telemetry_throttled_idx" ON "amazon_api_telemetry"("sellerId", "marketplaceId", "throttled", "observedAt");
CREATE UNIQUE INDEX "amazon_notification_subscriptions_scope_type_unique" ON "amazon_notification_subscriptions"("sellerId", "marketplaceId", "notificationType", "payloadVersion");
CREATE INDEX "amazon_notification_subscriptions_scope_status_idx" ON "amazon_notification_subscriptions"("sellerId", "marketplaceId", "status");
