CREATE TABLE IF NOT EXISTS "amazon_connections" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "userType" VARCHAR(50) NOT NULL DEFAULT 'inventoryusers',
    "sellerId" VARCHAR(255) NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "marketplaceId" VARCHAR(50) NOT NULL DEFAULT 'A21TJRUUN4KGV',
    "createdAt" BIGINT,
    "updatedAt" BIGINT,
    CONSTRAINT "amazon_connections_pkey" PRIMARY KEY ("id")
);

DROP INDEX IF EXISTS "amazon_connections_userId_sellerId_userType_key";
CREATE UNIQUE INDEX IF NOT EXISTS "amazon_connections_userId_sellerId_marketplaceId_userType_key"
    ON "amazon_connections"("userId", "sellerId", "marketplaceId", "userType");
CREATE INDEX IF NOT EXISTS "amazon_connections_userId_userType_idx"
    ON "amazon_connections"("userId", "userType");
CREATE INDEX IF NOT EXISTS "amazon_connections_sellerId_idx"
    ON "amazon_connections"("sellerId");
