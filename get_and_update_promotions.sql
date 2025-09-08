-- Simple script to get current promotions and update auto_apply settings

-- Step 1: Get current promotions
SELECT 
    id, 
    name, 
    type, 
    auto_apply, 
    is_active, 
    priority,
    conditions,
    actions
FROM promotions 
ORDER BY id;

-- Step 2: Update all promotions to set auto_apply = FALSE except ID 58
UPDATE promotions 
SET 
    auto_apply = FALSE, 
    modifieddate = EXTRACT(EPOCH FROM NOW()) * 1000
WHERE id != 58;

-- Step 3: Update promotion 58 for free shipping over ₹500
UPDATE promotions 
SET 
    name = 'Free Shipping Over ₹500',
    description = 'Automatic free shipping on orders above ₹500',
    type = 'FREE_SHIPPING',
    code = NULL,
    auto_apply = TRUE,
    is_active = TRUE,
    start_date = '2024-01-01',
    end_date = '2024-12-31',
    status = 'active',
    priority = 10,
    visibility = 'all',
    stackable = TRUE,
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
    priority,
    conditions
FROM promotions 
ORDER BY id;
