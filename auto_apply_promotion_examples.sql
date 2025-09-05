-- Comprehensive Auto-Apply Promotion Examples
-- This script shows all possible use cases for auto_apply promotions

-- =============================================
-- 1. FREE SHIPPING PROMOTIONS (Most Common)
-- =============================================

-- Free Shipping Over ₹500 (Basic)
INSERT INTO promotions (
    name, description, type, code, auto_apply, is_active,
    start_date, end_date, status, priority, visibility, stackable,
    conditions, actions, createddate, modifieddate
) VALUES (
    'Free Shipping Over ₹500',
    'Automatic free shipping on orders above ₹500',
    'FREE_SHIPPING',
    NULL, TRUE, TRUE,
    '2024-01-01', '2024-12-31', 'active', 10, 'all', TRUE,
    '[{"attribute": "cart.total_value", "operator": "GTE", "value": 500}]',
    '[{"type": "FREE_SHIPPING", "value": true}]',
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Free Shipping Over ₹1000 (Premium)
INSERT INTO promotions (
    name, description, type, code, auto_apply, is_active,
    start_date, end_date, status, priority, visibility, stackable,
    conditions, actions, createddate, modifieddate
) VALUES (
    'Premium Free Shipping Over ₹1000',
    'Premium free shipping on orders above ₹1000',
    'FREE_SHIPPING',
    NULL, TRUE, TRUE,
    '2024-01-01', '2024-12-31', 'active', 5, 'all', TRUE,
    '[{"attribute": "cart.total_value", "operator": "GTE", "value": 1000}]',
    '[{"type": "FREE_SHIPPING", "value": true}]',
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- =============================================
-- 2. CATEGORY-SPECIFIC AUTO DISCOUNTS
-- =============================================

-- 10% Off on Electronics (Auto-apply)
INSERT INTO promotions (
    name, description, type, code, auto_apply, is_active,
    start_date, end_date, status, priority, visibility, stackable,
    conditions, actions, createddate, modifieddate
) VALUES (
    'Electronics 10% Off',
    'Automatic 10% discount on electronics',
    'PERCENT_OFF_CART',
    NULL, TRUE, TRUE,
    '2024-01-01', '2024-12-31', 'active', 8, 'all', TRUE,
    '[{"attribute": "cart.category", "operator": "IN", "value": ["electronics"]}]',
    '[{"type": "PERCENT_OFF", "value": 10}]',
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- =============================================
-- 3. USER SEGMENT AUTO PROMOTIONS
-- =============================================

-- VIP Member Free Shipping (Auto-apply)
INSERT INTO promotions (
    name, description, type, code, auto_apply, is_active,
    start_date, end_date, status, priority, visibility, stackable,
    conditions, actions, createddate, modifieddate
) VALUES (
    'VIP Member Free Shipping',
    'Free shipping for VIP members',
    'FREE_SHIPPING',
    NULL, TRUE, TRUE,
    '2024-01-01', '2024-12-31', 'active', 3, 'all', TRUE,
    '[{"attribute": "user.segment", "operator": "IN", "value": ["vip_member"]}]',
    '[{"type": "FREE_SHIPPING", "value": true}]',
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- =============================================
-- 4. QUANTITY-BASED AUTO PROMOTIONS
-- =============================================

-- Buy 2 Get 1 Free (Auto-apply)
INSERT INTO promotions (
    name, description, type, code, auto_apply, is_active,
    start_date, end_date, status, priority, visibility, stackable,
    conditions, actions, createddate, modifieddate
) VALUES (
    'Buy 2 Get 1 Free',
    'Automatic BOGO on 3+ items',
    'BOGO',
    NULL, TRUE, TRUE,
    '2024-01-01', '2024-12-31', 'active', 7, 'all', TRUE,
    '[{"attribute": "cart.item_count", "operator": "GTE", "value": 3}]',
    '[{"type": "BOGO", "value": 1}]',
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- =============================================
-- 5. TIME-BASED AUTO PROMOTIONS
-- =============================================

-- Flash Sale 15% Off (Auto-apply for 1 hour)
INSERT INTO promotions (
    name, description, type, code, auto_apply, is_active,
    start_date, end_date, status, priority, visibility, stackable,
    conditions, actions, createddate, modifieddate
) VALUES (
    'Flash Sale 15% Off',
    'Limited time 15% off for all users',
    'PERCENT_OFF_CART',
    NULL, TRUE, TRUE,
    NOW(), NOW() + INTERVAL '1 hour', 'active', 2, 'all', TRUE,
    '[]',  -- No conditions, applies to all
    '[{"type": "PERCENT_OFF", "value": 15}]',
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- =============================================
-- 6. PAYMENT METHOD AUTO PROMOTIONS
-- =============================================

-- Credit Card 5% Cashback (Auto-apply)
INSERT INTO promotions (
    name, description, type, code, auto_apply, is_active,
    start_date, end_date, status, priority, visibility, stackable,
    conditions, actions, createddate, modifieddate
) VALUES (
    'Credit Card 5% Cashback',
    '5% cashback on credit card payments',
    'PERCENT_OFF_CART',
    NULL, TRUE, TRUE,
    '2024-01-01', '2024-12-31', 'active', 6, 'all', TRUE,
    '[{"attribute": "payment.method", "operator": "EQ", "value": "credit_card"}]',
    '[{"type": "PERCENT_OFF", "value": 5}]',
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- =============================================
-- 7. GEOGRAPHIC AUTO PROMOTIONS
-- =============================================

-- Mumbai Free Delivery (Auto-apply)
INSERT INTO promotions (
    name, description, type, code, auto_apply, is_active,
    start_date, end_date, status, priority, visibility, stackable,
    conditions, actions, createddate, modifieddate
) VALUES (
    'Mumbai Free Delivery',
    'Free delivery for Mumbai customers',
    'FREE_SHIPPING',
    NULL, TRUE, TRUE,
    '2024-01-01', '2024-12-31', 'active', 9, 'all', TRUE,
    '[{"attribute": "user.geo", "operator": "EQ", "value": "Mumbai"}]',
    '[{"type": "FREE_SHIPPING", "value": true}]',
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- =============================================
-- 8. FIRST-TIME USER AUTO PROMOTIONS
-- =============================================

-- First Order 10% Off (Auto-apply)
INSERT INTO promotions (
    name, description, type, code, auto_apply, is_active,
    start_date, end_date, status, priority, visibility, stackable,
    conditions, actions, createddate, modifieddate
) VALUES (
    'First Order 10% Off',
    'Welcome discount for first-time users',
    'PERCENT_OFF_CART',
    NULL, TRUE, TRUE,
    '2024-01-01', '2024-12-31', 'active', 4, 'all', TRUE,
    '[{"attribute": "user.order_count", "operator": "EQ", "value": 0}]',
    '[{"type": "PERCENT_OFF", "value": 10}]',
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- =============================================
-- 9. SEASONAL AUTO PROMOTIONS
-- =============================================

-- Diwali Special 20% Off (Auto-apply)
INSERT INTO promotions (
    name, description, type, code, auto_apply, is_active,
    start_date, end_date, status, priority, visibility, stackable,
    conditions, actions, createddate, modifieddate
) VALUES (
    'Diwali Special 20% Off',
    'Festive season discount for all users',
    'PERCENT_OFF_CART',
    NULL, TRUE, TRUE,
    '2024-10-15', '2024-11-15', 'active', 1, 'all', TRUE,
    '[]',  -- No conditions, applies to all
    '[{"type": "PERCENT_OFF", "value": 20}]',
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- =============================================
-- 10. LOYALTY TIER AUTO PROMOTIONS
-- =============================================

-- Gold Member 15% Off (Auto-apply)
INSERT INTO promotions (
    name, description, type, code, auto_apply, is_active,
    start_date, end_date, status, priority, visibility, stackable,
    conditions, actions, createddate, modifieddate
) VALUES (
    'Gold Member 15% Off',
    'Exclusive discount for gold tier members',
    'PERCENT_OFF_CART',
    NULL, TRUE, TRUE,
    '2024-01-01', '2024-12-31', 'active', 2, 'all', TRUE,
    '[{"attribute": "user.segment", "operator": "IN", "value": ["gold_member"]}]',
    '[{"type": "PERCENT_OFF", "value": 15}]',
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- =============================================
-- SUMMARY OF AUTO-APPLY USE CASES
-- =============================================

/*
AUTO-APPLY PROMOTION USE CASES:

1. FREE SHIPPING (Most Common)
   - Over cart value threshold
   - For specific user segments
   - For specific geographic regions
   - For specific payment methods

2. CATEGORY DISCOUNTS
   - Electronics, Fashion, Wellness, etc.
   - Based on cart contents
   - Percentage or fixed amount

3. USER SEGMENT REWARDS
   - VIP members
   - Loyalty tiers
   - First-time users
   - High-value customers

4. QUANTITY INCENTIVES
   - Buy X Get Y free
   - Bulk discounts
   - Minimum quantity thresholds

5. TIME-BASED OFFERS
   - Flash sales
   - Limited-time promotions
   - Seasonal discounts
   - End-of-day offers

6. PAYMENT METHOD REWARDS
   - Credit card cashback
   - UPI discounts
   - Wallet bonuses
   - EMI offers

7. GEOGRAPHIC TARGETING
   - City-specific offers
   - Regional promotions
   - Delivery area incentives

8. LOYALTY PROGRAM
   - Tier-based discounts
   - Points redemption
   - Anniversary rewards
   - Referral bonuses

9. CROSS-SELL/UPSELL
   - Complementary product discounts
   - Bundle offers
   - Add-on promotions

10. RETENTION CAMPAIGNS
    - Win-back offers
    - Reactivation discounts
    - Churn prevention
*/
