-- Script to update promotions auto_apply settings
-- 1. Set all auto_apply to FALSE except promotion ID 58
-- 2. Update promotion 58 for free shipping over ₹500

-- Step 1: Get current promotions with auto_apply status
SELECT 
    id, 
    name, 
    type, 
    auto_apply, 
    is_active, 
    conditions,
    actions
FROM promotions 
ORDER BY id;

-- Step 2: Set all auto_apply to FALSE except promotion ID 58
UPDATE promotions 
SET auto_apply = FALSE, 
    modifieddate = EXTRACT(EPOCH FROM NOW()) * 1000
WHERE id != 58;

-- Step 3: Update promotion 58 for free shipping over ₹500
UPDATE promotions 
SET 
    name = 'Free Shipping Over ₹500',
    description = 'Automatic free shipping on orders above ₹500',
    type = 'FREE_SHIPPING',
    code = NULL,  -- No coupon code for automatic promotions
    auto_apply = TRUE,
    is_active = TRUE,
    start_date = '2024-01-01',
    end_date = '2024-12-31',
    status = 'active',
    priority = 10,  -- Lower priority (applied after user coupons)
    visibility = 'all',
    stackable = TRUE,  -- Free shipping stacks with other promotions
    conditions = '[{"attribute": "cart.total_value", "operator": "GTE", "value": 500}]',
    actions = '[{"type": "FREE_SHIPPING", "value": true}]',
    modifieddate = EXTRACT(EPOCH FROM NOW()) * 1000
WHERE id = 58;

-- Step 4: Verify the changes
SELECT 
    id, 
    name, 
    type, 
    auto_apply, 
    is_active, 
    conditions,
    actions,
    priority
FROM promotions 
WHERE auto_apply = TRUE
ORDER BY priority;

-- Step 5: Show all promotions with their auto_apply status
SELECT 
    id, 
    name, 
    type, 
    auto_apply, 
    is_active,
    priority
FROM promotions 
ORDER BY id;
