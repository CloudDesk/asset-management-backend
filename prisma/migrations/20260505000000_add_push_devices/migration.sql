CREATE TABLE IF NOT EXISTS "push_devices" (
  "id" SERIAL PRIMARY KEY,
  "userid" INTEGER NULL,
  "inventoryuserid" INTEGER NULL,
  "usertype" VARCHAR(30) NOT NULL,
  "token" VARCHAR(2048) NOT NULL UNIQUE,
  "platform" VARCHAR(30) NOT NULL,
  "provider" VARCHAR(30) NOT NULL,
  "deviceid" VARCHAR(255) NULL,
  "appversion" VARCHAR(100) NULL,
  "buildnumber" VARCHAR(100) NULL,
  "permissionstatus" VARCHAR(50) NULL,
  "isactive" BOOLEAN NOT NULL DEFAULT TRUE,
  "failurecount" INTEGER NOT NULL DEFAULT 0,
  "createddate" BIGINT NULL,
  "modifieddate" BIGINT NULL,
  "lastseenat" BIGINT NULL,
  "disabledat" BIGINT NULL
);

CREATE INDEX IF NOT EXISTS "push_devices_userid_idx" ON "push_devices" ("userid");
CREATE INDEX IF NOT EXISTS "push_devices_inventoryuserid_idx" ON "push_devices" ("inventoryuserid");
CREATE INDEX IF NOT EXISTS "push_devices_usertype_idx" ON "push_devices" ("usertype");
CREATE INDEX IF NOT EXISTS "push_devices_platform_idx" ON "push_devices" ("platform");
CREATE INDEX IF NOT EXISTS "push_devices_isactive_idx" ON "push_devices" ("isactive");
