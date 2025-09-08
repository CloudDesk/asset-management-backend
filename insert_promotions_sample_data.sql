-- Insert Sample Promotions Data
-- This script inserts 6 different types of promotions with proper conditions and actions

-- Case 1: Cart-level fixed discount - "₹100 OFF on orders above ₹1000"
INSERT INTO promotions (
    name, 
    description, 
    type, 
    code, 
    auto_apply, 
    is_active, 
    start_date, 
    end_date, 
    status, 
    priority, 
    visibility, 
    max_redemptions, 
    per_user_limit, 
    stackable, 
    budget, 
    timezone, 
    evaluation_expiry_minutes, 
    discount_type, 
    discount_value, 
    conditions, 
    actions, 
    createddate, 
    modifieddate
) VALUES (
    '₹100 OFF on Orders Above ₹1000',
    'Get ₹100 off on all orders above ₹1000. Valid on all products.',
    'FIXED_AMOUNT_OFF_CART',
    NULL, -- No coupon code needed (auto-apply)
    true, -- Auto-apply
    true, -- Active
    '2024-01-01 00:00:00', -- Start date
    '2024-12-31 23:59:59', -- End date
    'active',
    1, -- High priority
    'public', -- Visible to all users
    10000, -- Max 10,000 redemptions
    5, -- 5 uses per user
    true, -- Stackable with other promotions
    1000000.00, -- ₹10,00,000 budget
    'Asia/Kolkata',
    15, -- 15 minutes expiry
    'FIXED_AMOUNT_OFF',
    100.00, -- ₹100 discount
    '[
        {
            "attribute": "cart.total_value",
            "operator": "GTE",
            "value": 1000
        }
    ]'::jsonb, -- Condition: cart total >= ₹1000
    '[
        {
            "type": "FIXED_AMOUNT_OFF",
            "value": 100
        }
    ]'::jsonb, -- Action: ₹100 off
    EXTRACT(EPOCH FROM NOW()) * 1000, -- Created date
    EXTRACT(EPOCH FROM NOW()) * 1000  -- Modified date
);

-- Case 2: Category-based discount - "20% OFF on Wellness products, min cart value ₹500"
INSERT INTO promotions (
    name, 
    description, 
    type, 
    code, 
    auto_apply, 
    is_active, 
    start_date, 
    end_date, 
    status, 
    priority, 
    visibility, 
    max_redemptions, 
    per_user_limit, 
    stackable, 
    budget, 
    timezone, 
    evaluation_expiry_minutes, 
    discount_type, 
    discount_value, 
    conditions, 
    actions, 
    createddate, 
    modifieddate
) VALUES (
    '20% OFF on Wellness Products',
    'Get 20% off on all wellness products with minimum cart value of ₹500.',
    'PERCENT_OFF_ITEM',
    NULL, -- Auto-apply
    true, -- Auto-apply
    true, -- Active
    '2024-01-01 00:00:00',
    '2024-12-31 23:59:59',
    'active',
    2, -- Medium priority
    'public',
    5000, -- 5,000 redemptions
    3, -- 3 uses per user
    true, -- Stackable
    500000.00, -- ₹5,00,000 budget
    'Asia/Kolkata',
    15,
    'PERCENT_OFF',
    20.00, -- 20% discount
    '[
        {
            "attribute": "cart.total_value",
            "operator": "GTE",
            "value": 500
        },
        {
            "attribute": "cart.items.category",
            "operator": "IN",
            "value": ["Wellness", "Health", "Natural"]
        }
    ]'::jsonb, -- Conditions: cart total >= ₹500 AND category in wellness
    '[
        {
            "type": "PERCENT_OFF",
            "value": 20
        }
    ]'::jsonb, -- Action: 20% off
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Case 3: BOGO (Buy One Get One Free) - "Buy 1 Rosemary Essential Oil, Get 1 Free"
INSERT INTO promotions (
    name, 
    description, 
    type, 
    code, 
    auto_apply, 
    is_active, 
    start_date, 
    end_date, 
    status, 
    priority, 
    visibility, 
    max_redemptions, 
    per_user_limit, 
    stackable, 
    budget, 
    timezone, 
    evaluation_expiry_minutes, 
    discount_type, 
    discount_value, 
    conditions, 
    actions, 
    createddate, 
    modifieddate
) VALUES (
    'Buy 1 Rosemary Essential Oil, Get 1 Free',
    'Purchase one Rosemary Essential Oil and get another one absolutely free!',
    'BOGO',
    'BOGO_ROSEMARY', -- Coupon code
    false, -- Not auto-apply (requires coupon)
    true, -- Active
    '2024-01-01 00:00:00',
    '2024-12-31 23:59:59',
    'active',
    3, -- Medium priority
    'public',
    2000, -- 2,000 redemptions
    2, -- 2 uses per user
    false, -- Not stackable with other BOGO
    200000.00, -- ₹2,00,000 budget
    'Asia/Kolkata',
    15,
    'BOGO',
    100.00, -- 100% off on second item
    '[
        {
            "attribute": "cart.items.sku",
            "operator": "IN",
            "value": ["ROSEMARY_ESSENTIAL_OIL_100ML", "ROSEMARY_ESSENTIAL_OIL_50ML"]
        },
        {
            "attribute": "cart.items.quantity",
            "operator": "GTE",
            "value": 1
        }
    ]'::jsonb, -- Conditions: SKU in rosemary oils AND quantity >= 1
    '[
        {
            "type": "BOGO",
            "value": 1
        }
    ]'::jsonb, -- Action: Buy 1 Get 1
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Case 4: Free Shipping Festival Offer - "Free shipping for all orders during Diwali (Oct 1–Oct 5)"
INSERT INTO promotions (
    name, 
    description, 
    type, 
    code, 
    auto_apply, 
    is_active, 
    start_date, 
    end_date, 
    status, 
    priority, 
    visibility, 
    max_redemptions, 
    per_user_limit, 
    stackable, 
    budget, 
    timezone, 
    evaluation_expiry_minutes, 
    discount_type, 
    discount_value, 
    conditions, 
    actions, 
    createddate, 
    modifieddate
) VALUES (
    'Diwali Free Shipping Festival',
    'Free shipping on all orders during Diwali festival (October 1-5). No minimum order value required.',
    'FREE_SHIPPING',
    NULL, -- Auto-apply
    true, -- Auto-apply
    true, -- Active
    '2024-10-01 00:00:00', -- Diwali start
    '2024-10-05 23:59:59', -- Diwali end
    'active',
    1, -- High priority (festival offer)
    'public',
    15000, -- 15,000 redemptions
    10, -- 10 uses per user
    true, -- Stackable with other promotions
    750000.00, -- ₹7,50,000 budget
    'Asia/Kolkata',
    15,
    'FREE_SHIPPING',
    50.00, -- ₹50 shipping cost waived
    '[
        {
            "attribute": "cart.total_value",
            "operator": "GTE",
            "value": 0
        }
    ]'::jsonb, -- Condition: any cart value (no minimum)
    '[
        {
            "type": "FREE_SHIPPING",
            "value": true
        }
    ]'::jsonb, -- Action: Free shipping
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Case 5: Progressive Discount - "Get 5% OFF above ₹1000, 10% OFF above ₹2000"
-- This requires two separate promotions for different tiers

-- Progressive Discount Tier 1: 5% OFF above ₹1000
INSERT INTO promotions (
    name, 
    description, 
    type, 
    code, 
    auto_apply, 
    is_active, 
    start_date, 
    end_date, 
    status, 
    priority, 
    visibility, 
    max_redemptions, 
    per_user_limit, 
    stackable, 
    budget, 
    timezone, 
    evaluation_expiry_minutes, 
    discount_type, 
    discount_value, 
    conditions, 
    actions, 
    createddate, 
    modifieddate
) VALUES (
    'Progressive Discount - 5% OFF (₹1000+)',
    'Get 5% off on orders above ₹1000. Higher discounts available for larger orders.',
    'PERCENT_OFF_CART',
    NULL, -- Auto-apply
    true, -- Auto-apply
    true, -- Active
    '2024-01-01 00:00:00',
    '2024-12-31 23:59:59',
    'active',
    4, -- Lower priority than higher tier
    'public',
    8000, -- 8,000 redemptions
    5, -- 5 uses per user
    false, -- Not stackable with other progressive discounts
    400000.00, -- ₹4,00,000 budget
    'Asia/Kolkata',
    15,
    'PERCENT_OFF',
    5.00, -- 5% discount
    '[
        {
            "attribute": "cart.total_value",
            "operator": "GTE",
            "value": 1000
        },
        {
            "attribute": "cart.total_value",
            "operator": "LT",
            "value": 2000
        }
    ]'::jsonb, -- Conditions: cart total >= ₹1000 AND < ₹2000
    '[
        {
            "type": "PERCENT_OFF",
            "value": 5
        }
    ]'::jsonb, -- Action: 5% off
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Progressive Discount Tier 2: 10% OFF above ₹2000
INSERT INTO promotions (
    name, 
    description, 
    type, 
    code, 
    auto_apply, 
    is_active, 
    start_date, 
    end_date, 
    status, 
    priority, 
    visibility, 
    max_redemptions, 
    per_user_limit, 
    stackable, 
    budget, 
    timezone, 
    evaluation_expiry_minutes, 
    discount_type, 
    discount_value, 
    conditions, 
    actions, 
    createddate, 
    modifieddate
) VALUES (
    'Progressive Discount - 10% OFF (₹2000+)',
    'Get 10% off on orders above ₹2000. Maximum discount tier.',
    'PERCENT_OFF_CART',
    NULL, -- Auto-apply
    true, -- Auto-apply
    true, -- Active
    '2024-01-01 00:00:00',
    '2024-12-31 23:59:59',
    'active',
    3, -- Higher priority than lower tier
    'public',
    5000, -- 5,000 redemptions
    3, -- 3 uses per user
    false, -- Not stackable with other progressive discounts
    600000.00, -- ₹6,00,000 budget
    'Asia/Kolkata',
    15,
    'PERCENT_OFF',
    10.00, -- 10% discount
    '[
        {
            "attribute": "cart.total_value",
            "operator": "GTE",
            "value": 2000
        }
    ]'::jsonb, -- Condition: cart total >= ₹2000
    '[
        {
            "type": "PERCENT_OFF",
            "value": 10
        }
    ]'::jsonb, -- Action: 10% off
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Case 6: Free Product with Limited Stock - "Buy above ₹1500 and get 1 Free Herbal Oil 10ml (limited to 100 units)"
INSERT INTO promotions (
    name, 
    description, 
    type, 
    code, 
    auto_apply, 
    is_active, 
    start_date, 
    end_date, 
    status, 
    priority, 
    visibility, 
    max_redemptions, 
    per_user_limit, 
    stackable, 
    budget, 
    timezone, 
    evaluation_expiry_minutes, 
    discount_type, 
    discount_value, 
    conditions, 
    actions, 
    createddate, 
    modifieddate
) VALUES (
    'Free Herbal Oil with ₹1500+ Purchase',
    'Buy above ₹1500 and get 1 Free Herbal Oil 10ml. Limited to 100 units only!',
    'FREE_PRODUCT',
    'FREE_HERBAL_OIL', -- Coupon code
    false, -- Not auto-apply (requires coupon)
    true, -- Active
    '2024-01-01 00:00:00',
    '2024-12-31 23:59:59',
    'active',
    5, -- Lower priority (limited stock)
    'public',
    100, -- Limited to 100 redemptions
    1, -- 1 use per user
    true, -- Stackable with other promotions
    50000.00, -- ₹50,000 budget
    'Asia/Kolkata',
    15,
    'FREE_PRODUCT',
    150.00, -- ₹150 value of free product
    '[
        {
            "attribute": "cart.total_value",
            "operator": "GTE",
            "value": 1500
        }
    ]'::jsonb, -- Condition: cart total >= ₹1500
    '[
        {
            "type": "FREE_PRODUCT",
            "value": "HERBAL_OIL_10ML_SKU"
        }
    ]'::jsonb, -- Action: Free product with SKU
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Insert a few more sample promotions for variety

-- Welcome Discount for New Users
INSERT INTO promotions (
    name, 
    description, 
    type, 
    code, 
    auto_apply, 
    is_active, 
    start_date, 
    end_date, 
    status, 
    priority, 
    visibility, 
    max_redemptions, 
    per_user_limit, 
    stackable, 
    budget, 
    timezone, 
    evaluation_expiry_minutes, 
    discount_type, 
    discount_value, 
    conditions, 
    actions, 
    createddate, 
    modifieddate
) VALUES (
    'Welcome Discount - 15% OFF',
    'Special 15% discount for new users on their first order.',
    'PERCENT_OFF_CART',
    'WELCOME15', -- Coupon code
    false, -- Not auto-apply
    true, -- Active
    '2024-01-01 00:00:00',
    '2024-12-31 23:59:59',
    'active',
    2, -- Medium priority
    'public',
    3000, -- 3,000 redemptions
    1, -- 1 use per user (first order only)
    true, -- Stackable
    300000.00, -- ₹3,00,000 budget
    'Asia/Kolkata',
    15,
    'PERCENT_OFF',
    15.00, -- 15% discount
    '[
        {
            "attribute": "user.segment",
            "operator": "IN",
            "value": ["first_order", "new_user"]
        },
        {
            "attribute": "cart.total_value",
            "operator": "GTE",
            "value": 200
        }
    ]'::jsonb, -- Conditions: first order user AND cart total >= ₹200
    '[
        {
            "type": "PERCENT_OFF",
            "value": 15
        }
    ]'::jsonb, -- Action: 15% off
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Loyalty Member Discount
INSERT INTO promotions (
    name, 
    description, 
    type, 
    code, 
    auto_apply, 
    is_active, 
    start_date, 
    end_date, 
    status, 
    priority, 
    visibility, 
    max_redemptions, 
    per_user_limit, 
    stackable, 
    budget, 
    timezone, 
    evaluation_expiry_minutes, 
    discount_type, 
    discount_value, 
    conditions, 
    actions, 
    createddate, 
    modifieddate
) VALUES (
    'Loyalty Gold Member - 10% OFF',
    'Exclusive 10% discount for Gold tier loyalty members.',
    'PERCENT_OFF_CART',
    NULL, -- Auto-apply for loyalty members
    true, -- Auto-apply
    true, -- Active
    '2024-01-01 00:00:00',
    '2024-12-31 23:59:59',
    'active',
    1, -- High priority for loyalty
    'private', -- Private (only for loyalty members)
    2000, -- 2,000 redemptions
    10, -- 10 uses per user
    true, -- Stackable
    200000.00, -- ₹2,00,000 budget
    'Asia/Kolkata',
    15,
    'PERCENT_OFF',
    10.00, -- 10% discount
    '[
        {
            "attribute": "user.segment",
            "operator": "IN",
            "value": ["loyalty_tier_gold", "loyalty_tier_platinum"]
        }
    ]'::jsonb, -- Condition: Gold/Platinum loyalty member
    '[
        {
            "type": "PERCENT_OFF",
            "value": 10
        }
    ]'::jsonb, -- Action: 10% off
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Flash Sale Promotion
INSERT INTO promotions (
    name, 
    description, 
    type, 
    code, 
    auto_apply, 
    is_active, 
    start_date, 
    end_date, 
    status, 
    priority, 
    visibility, 
    max_redemptions, 
    per_user_limit, 
    stackable, 
    budget, 
    timezone, 
    evaluation_expiry_minutes, 
    discount_type, 
    discount_value, 
    conditions, 
    actions, 
    createddate, 
    modifieddate
) VALUES (
    'Flash Sale - 25% OFF Everything',
    'Limited time flash sale! Get 25% off on all products. Hurry, offer ends soon!',
    'PERCENT_OFF_CART',
    'FLASH25', -- Coupon code
    false, -- Not auto-apply
    true, -- Active
    '2024-06-01 00:00:00', -- Flash sale period
    '2024-06-03 23:59:59', -- 3-day flash sale
    'active',
    1, -- Highest priority (flash sale)
    'public',
    1000, -- Limited to 1,000 redemptions
    1, -- 1 use per user
    false, -- Not stackable (flash sale)
    250000.00, -- ₹2,50,000 budget
    'Asia/Kolkata',
    15,
    'PERCENT_OFF',
    25.00, -- 25% discount
    '[
        {
            "attribute": "cart.total_value",
            "operator": "GTE",
            "value": 100
        }
    ]'::jsonb, -- Condition: cart total >= ₹100
    '[
        {
            "type": "PERCENT_OFF",
            "value": 25
        }
    ]'::jsonb, -- Action: 25% off
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Display the inserted promotions
SELECT 
    id,
    name,
    type,
    code,
    auto_apply,
    is_active,
    status,
    priority,
    visibility,
    max_redemptions,
    discount_type,
    discount_value,
    createddate
FROM promotions 
ORDER BY priority, id;
