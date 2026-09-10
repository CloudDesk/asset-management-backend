ALTER TABLE "promotion_evaluations"
  ADD COLUMN "rule_snapshots" JSONB,
  ADD COLUMN "rule_snapshot_checksum" VARCHAR(64);

ALTER TABLE "orders"
  ADD COLUMN "promotion_rule_snapshots" JSONB;

CREATE OR REPLACE FUNCTION guard_published_promotion_rule_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'published' AND (
    NEW.promotion_id IS DISTINCT FROM OLD.promotion_id OR
    NEW.version IS DISTINCT FROM OLD.version OR
    NEW.schema_version IS DISTINCT FROM OLD.schema_version OR
    NEW.rule_json IS DISTINCT FROM OLD.rule_json OR
    NEW.checksum IS DISTINCT FROM OLD.checksum OR
    NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Published promotion rule versions are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER promotion_rule_versions_immutable_when_published
BEFORE UPDATE ON "promotion_rule_versions"
FOR EACH ROW
EXECUTE FUNCTION guard_published_promotion_rule_immutability();

CREATE OR REPLACE FUNCTION prevent_published_promotion_rule_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'published' THEN
    RAISE EXCEPTION 'Published promotion rule versions cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER promotion_rule_versions_preserve_published
BEFORE DELETE ON "promotion_rule_versions"
FOR EACH ROW
EXECUTE FUNCTION prevent_published_promotion_rule_delete();

CREATE OR REPLACE FUNCTION guard_immutable_promotion_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.rule_snapshots IS NOT NULL AND NEW.rule_snapshots IS DISTINCT FROM OLD.rule_snapshots THEN
    RAISE EXCEPTION 'Promotion evaluation rule snapshots are immutable';
  END IF;
  IF OLD.rule_snapshot_checksum IS NOT NULL AND NEW.rule_snapshot_checksum IS DISTINCT FROM OLD.rule_snapshot_checksum THEN
    RAISE EXCEPTION 'Promotion evaluation snapshot checksum is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER promotion_evaluations_immutable_snapshot
BEFORE UPDATE ON "promotion_evaluations"
FOR EACH ROW
EXECUTE FUNCTION guard_immutable_promotion_snapshot();

CREATE OR REPLACE FUNCTION guard_immutable_order_promotion_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.promotion_rule_snapshots IS NOT NULL AND NEW.promotion_rule_snapshots IS DISTINCT FROM OLD.promotion_rule_snapshots THEN
    RAISE EXCEPTION 'Order promotion rule snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_immutable_promotion_snapshot
BEFORE UPDATE ON "orders"
FOR EACH ROW
EXECUTE FUNCTION guard_immutable_order_promotion_snapshot();

CREATE TABLE "promotion_gift_entitlements" (
  "id" VARCHAR(36) PRIMARY KEY,
  "order_id" INTEGER NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "evaluation_id" VARCHAR(36) NOT NULL REFERENCES "promotion_evaluations"("evaluation_id") ON DELETE RESTRICT,
  "promotion_id" INTEGER NOT NULL REFERENCES "promotions"("id") ON DELETE RESTRICT,
  "promotion_rule_version_id" BIGINT NOT NULL REFERENCES "promotion_rule_versions"("id") ON DELETE RESTRICT,
  "gift_quantity" INTEGER NOT NULL CHECK ("gift_quantity" > 0),
  "reward_mode" VARCHAR(50) NOT NULL,
  "allowed_scope_json" JSONB,
  "status" VARCHAR(40) NOT NULL DEFAULT 'PENDING_PACKING',
  "selected_product_id" BIGINT REFERENCES "product"("id") ON DELETE RESTRICT,
  "selected_by_user_id" INTEGER,
  "selected_at" BIGINT,
  "created_at" BIGINT NOT NULL,
  "modified_at" BIGINT NOT NULL,
  CONSTRAINT "promotion_gift_entitlements_evaluation_promotion_key" UNIQUE ("evaluation_id", "promotion_id")
);

CREATE INDEX "promotion_gift_entitlements_order_status_idx"
  ON "promotion_gift_entitlements"("order_id", "status");
