-- CreateTable
CREATE TABLE "otp_store" (
    "id" SERIAL NOT NULL,
    "phoneNumber" VARCHAR(20) NOT NULL,
    "otp" VARCHAR(10),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "otpExpiresAt" BIGINT,
    "otpCreatedAt" BIGINT,
    "resendCooldownUntil" BIGINT,
    "sendCount" INTEGER NOT NULL DEFAULT 0,
    "sendWindowStart" BIGINT,
    "failedVerifyCount" INTEGER NOT NULL DEFAULT 0,
    "verifyWindowStart" BIGINT,
    "blockedUntil" BIGINT,
    "blockReason" VARCHAR(500),
    "createddate" BIGINT,
    "modifieddate" BIGINT,

    CONSTRAINT "otp_store_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "otp_store_phoneNumber_key" ON "otp_store"("phoneNumber");

-- CreateIndex
CREATE INDEX "otp_store_otpExpiresAt_idx" ON "otp_store"("otpExpiresAt");

-- CreateIndex
CREATE INDEX "otp_store_blockedUntil_idx" ON "otp_store"("blockedUntil");
