CREATE TABLE IF NOT EXISTS "return_replacement_policies" (
  "id" SERIAL PRIMARY KEY,
  "category" VARCHAR(255) NOT NULL,
  "subcategory" VARCHAR(255),
  "subsubcategory" VARCHAR(255),
  "scopekey" VARCHAR(900) NOT NULL UNIQUE,
  "returnallowed" BOOLEAN NOT NULL DEFAULT false,
  "replacementallowed" BOOLEAN NOT NULL DEFAULT false,
  "returnwindowdays" INTEGER,
  "replacementwindowdays" INTEGER,
  "allowedrefundmethods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "isactive" BOOLEAN NOT NULL DEFAULT true,
  "createdby" INTEGER,
  "modifiedby" INTEGER,
  "createddate" BIGINT,
  "modifieddate" BIGINT
);

CREATE INDEX IF NOT EXISTS "idx_return_replacement_policy_scope"
  ON "return_replacement_policies" ("category", "subcategory", "subsubcategory");

CREATE INDEX IF NOT EXISTS "idx_return_replacement_policy_isactive"
  ON "return_replacement_policies" ("isactive");
