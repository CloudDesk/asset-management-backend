CREATE TABLE "promotion_rule_versions" (
  "id" BIGSERIAL PRIMARY KEY,
  "promotion_id" INTEGER NOT NULL REFERENCES "promotions"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL,
  "schema_version" INTEGER NOT NULL DEFAULT 2,
  "rule_json" JSONB NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
  "published_at" BIGINT,
  "published_by" INTEGER,
  "checksum" VARCHAR(64) NOT NULL,
  "created_at" BIGINT NOT NULL,
  "modified_at" BIGINT NOT NULL,
  CONSTRAINT "promotion_rule_versions_promotion_id_version_key" UNIQUE ("promotion_id", "version")
);

CREATE INDEX "promotion_rule_versions_promotion_id_status_idx"
  ON "promotion_rule_versions"("promotion_id", "status");
CREATE INDEX "promotion_rule_versions_status_published_at_idx"
  ON "promotion_rule_versions"("status", "published_at");

CREATE TABLE "promotion_targets" (
  "id" BIGSERIAL PRIMARY KEY,
  "promotion_rule_version_id" BIGINT NOT NULL REFERENCES "promotion_rule_versions"("id") ON DELETE CASCADE,
  "facet_type" VARCHAR(40) NOT NULL,
  "facet_value" VARCHAR(255) NOT NULL,
  "inclusion" VARCHAR(10) NOT NULL DEFAULT 'include',
  "created_at" BIGINT NOT NULL,
  CONSTRAINT "promotion_targets_rule_facet_value_inclusion_key"
    UNIQUE ("promotion_rule_version_id", "facet_type", "facet_value", "inclusion")
);

CREATE INDEX "promotion_targets_facet_type_facet_value_inclusion_idx"
  ON "promotion_targets"("facet_type", "facet_value", "inclusion");

CREATE TABLE "promotion_evaluation_adjustments" (
  "id" VARCHAR(36) PRIMARY KEY,
  "evaluation_id" VARCHAR(36) NOT NULL REFERENCES "promotion_evaluations"("evaluation_id") ON DELETE CASCADE,
  "promotion_id" INTEGER NOT NULL REFERENCES "promotions"("id") ON DELETE CASCADE,
  "promotion_rule_version_id" BIGINT REFERENCES "promotion_rule_versions"("id") ON DELETE SET NULL,
  "adjustment_type" VARCHAR(40) NOT NULL,
  "cart_record_id" VARCHAR(100),
  "product_id" BIGINT,
  "affected_quantity" INTEGER NOT NULL DEFAULT 1,
  "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "list_amount" DECIMAL(12,2),
  "payable_amount" DECIMAL(12,2),
  "source_product_ids" JSONB,
  "metadata" JSONB,
  "created_at" BIGINT NOT NULL
);

CREATE INDEX "promotion_evaluation_adjustments_evaluation_id_idx"
  ON "promotion_evaluation_adjustments"("evaluation_id");
CREATE INDEX "promotion_evaluation_adjustments_promotion_id_idx"
  ON "promotion_evaluation_adjustments"("promotion_id");
CREATE INDEX "promotion_evaluation_adjustments_product_id_idx"
  ON "promotion_evaluation_adjustments"("product_id");

ALTER TABLE "orderline"
  ADD COLUMN "line_type" VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "promotion_id" INTEGER REFERENCES "promotions"("id") ON DELETE SET NULL,
  ADD COLUMN "promotion_adjustment_id" VARCHAR(36) REFERENCES "promotion_evaluation_adjustments"("id") ON DELETE SET NULL,
  ADD COLUMN "parent_orderline_id" INTEGER REFERENCES "orderline"("id") ON DELETE SET NULL,
  ADD COLUMN "list_unit_price" DECIMAL(10,2),
  ADD COLUMN "promotion_unit_discount" DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN "is_free_item" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX "orderline_promotion_id_idx" ON "orderline"("promotion_id");
CREATE INDEX "orderline_parent_orderline_id_idx" ON "orderline"("parent_orderline_id");
CREATE INDEX "orderline_promotion_adjustment_id_idx" ON "orderline"("promotion_adjustment_id");
