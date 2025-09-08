-- Migration: Add promotion tracking fields to orders and orderlines
-- This migration adds comprehensive promotion tracking to orders and orderlines

-- Add promotion tracking fields to orders table
ALTER TABLE orders 
ADD COLUMN evaluation_id VARCHAR(36),
ADD COLUMN promotion_discount_total DECIMAL(10,2) DEFAULT 0,
ADD COLUMN original_total DECIMAL(10,2),
ADD COLUMN final_total DECIMAL(10,2),
ADD COLUMN promotion_breakdown JSON;

-- Add promotion tracking fields to orderline table
ALTER TABLE orderline 
ADD COLUMN original_price DECIMAL(10,2),
ADD COLUMN product_discount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN promotion_discount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN applied_promotions JSON,
ADD COLUMN evaluation_id VARCHAR(36);

-- Add indexes for better performance
CREATE INDEX idx_orders_evaluation_id ON orders(evaluation_id);
CREATE INDEX idx_orderline_evaluation_id ON orderline(evaluation_id);
CREATE INDEX idx_orderline_applied_promotions ON orderline USING GIN(applied_promotions);

-- Add foreign key constraints (optional, for data integrity)
-- ALTER TABLE orders ADD CONSTRAINT fk_orders_evaluation_id 
--   FOREIGN KEY (evaluation_id) REFERENCES promotion_evaluations(evaluation_id);
-- ALTER TABLE orderline ADD CONSTRAINT fk_orderline_evaluation_id 
--   FOREIGN KEY (evaluation_id) REFERENCES promotion_evaluations(evaluation_id);

-- Add comments for documentation
COMMENT ON COLUMN orders.evaluation_id IS 'Links to promotion_evaluations record used for this order';
COMMENT ON COLUMN orders.promotion_discount_total IS 'Total discount amount from all promotions applied';
COMMENT ON COLUMN orders.original_total IS 'Cart total before any discounts were applied';
COMMENT ON COLUMN orders.final_total IS 'Final order amount after all discounts';
COMMENT ON COLUMN orders.promotion_breakdown IS 'JSON breakdown of all promotions applied to this order';

COMMENT ON COLUMN orderline.original_price IS 'Original product price before any discounts';
COMMENT ON COLUMN orderline.product_discount IS 'Discount amount from product-level promotions';
COMMENT ON COLUMN orderline.promotion_discount IS 'Discount amount from cart-level promotions';
COMMENT ON COLUMN orderline.applied_promotions IS 'JSON array of promotion details applied to this orderline';
COMMENT ON COLUMN orderline.evaluation_id IS 'Links to promotion_evaluations record used for this orderline';
