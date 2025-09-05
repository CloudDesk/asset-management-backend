-- Insert Free Shipping Over ₹500 Promotion (Automatic)
INSERT INTO promotions (
  name, 
  description, 
  type, 
  code,           -- NULL for automatic promotions
  auto_apply,     -- TRUE for automatic promotions
  is_active, 
  start_date, 
  end_date, 
  status, 
  priority, 
  visibility, 
  stackable,      -- TRUE (free shipping stacks with other discounts)
  conditions,     -- JSON conditions
  actions,        -- JSON actions
  createddate,
  modifieddate
) VALUES (
  'Free Shipping Over ₹500',
  'Automatic free shipping on orders above ₹500',
  'FREE_SHIPPING',
  NULL,           -- No coupon code needed
  TRUE,           -- Auto-apply = TRUE
  TRUE,
  '2024-01-01',
  '2024-12-31',
  'active',
  10,             -- Lower priority (applied after user coupons)
  'all',
  TRUE,           -- Stackable with other promotions
  '[{"attribute": "cart.total_value", "operator": "GTE", "value": 500}]',
  '[{"type": "FREE_SHIPPING", "value": true}]',
  EXTRACT(EPOCH FROM NOW()) * 1000,
  EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Insert another example: Free Shipping Over ₹1000 (Higher threshold)
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
  stackable,
  conditions,
  actions,
  createddate,
  modifieddate
) VALUES (
  'Premium Free Shipping Over ₹1000',
  'Premium free shipping on orders above ₹1000',
  'FREE_SHIPPING',
  NULL,
  TRUE,
  TRUE,
  '2024-01-01',
  '2024-12-31',
  'active',
  5,              -- Higher priority (applied before ₹500 promotion)
  'all',
  TRUE,
  '[{"attribute": "cart.total_value", "operator": "GTE", "value": 1000}]',
  '[{"type": "FREE_SHIPPING", "value": true}]',
  EXTRACT(EPOCH FROM NOW()) * 1000,
  EXTRACT(EPOCH FROM NOW()) * 1000
);

-- Insert example: User-applied coupon (FLAT20)
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
  stackable,
  conditions,
  actions,
  createddate,
  modifieddate
) VALUES (
  'Flat ₹20 Off',
  'Get ₹20 off on your order',
  'FIXED_AMOUNT_OFF_CART',
  'FLAT20',
  FALSE,           -- User-applied coupon
  TRUE,
  '2024-01-01',
  '2024-12-31',
  'active',
  1,               -- Highest priority
  'all',
  TRUE,            -- Stackable with free shipping
  '[{"attribute": "cart.total_value", "operator": "GTE", "value": 100}]',
  '[{"type": "FIXED_AMOUNT_OFF", "value": 20}]',
  EXTRACT(EPOCH FROM NOW()) * 1000,
  EXTRACT(EPOCH FROM NOW()) * 1000
);
