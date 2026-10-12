CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "idx_product_instore_name_trgm"
ON "product" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_product_instore_puc_trgm"
ON "product" USING GIN ("puc" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_users_instore_name_trgm"
ON "users" USING GIN (
  (COALESCE("firstname", '') || ' ' || COALESCE("lastname", '')) gin_trgm_ops
)
WHERE "isactive" IS DISTINCT FROM FALSE;

CREATE INDEX IF NOT EXISTS "idx_users_instore_email_trgm"
ON "users" USING GIN ((COALESCE("useremail", '')) gin_trgm_ops)
WHERE "isactive" IS DISTINCT FROM FALSE;

CREATE INDEX IF NOT EXISTS "idx_users_instore_mobile"
ON "users" ("usermobilenumber")
WHERE "isactive" IS DISTINCT FROM FALSE;

CREATE INDEX IF NOT EXISTS "idx_users_instore_recent"
ON "users" ("createddate" DESC NULLS LAST, "id" DESC)
WHERE "isactive" IS DISTINCT FROM FALSE;
