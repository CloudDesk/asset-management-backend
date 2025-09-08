# Multiple Promotion Evaluation Flow Example

## Scenario: User with Cart + Applied Coupon + Automatic Free Shipping

### Cart Details
- **User ID**: 24
- **Cart Total**: ₹600 (before discounts)
- **Items**: 2x Electronics (₹300 each)

### Promotions Available
1. **FLAT20** (ID: 15) - 20% off on electronics (user-applied)
2. **Free Shipping Over ₹500** (ID: 58) - Automatic free shipping

---

## Step 1: User Applies Coupon

### Request
```bash
curl -X POST http://localhost:5600/v1/promotions/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "24",
    "promotion_id": 15,
    "cart_items": [
      {
        "cart_record_id": "410",
        "product_id": "14",
        "quantity": 2,
        "price": 300,
        "category": "electronics",
        "name": "Gadget"
      }
    ],
    "context": {
      "channel": "web",
      "geo": "IN"
    }
  }'
```

### Response
```json
{
  "success": true,
  "data": {
    "evaluation_id": "eval_1736334000000_promo_15",
    "promotion_id": 15,
    "promotion_name": "FLAT20",
    "is_eligible": true,
    "original_total": 600,
    "discounted_total": 480,
    "total_discount": 120,
    "discount_breakdown": [
      {
        "cart_record_id": "410",
        "product_id": "14",
        "product_name": "Gadget",
        "category": "electronics",
        "quantity": 2,
        "original_price": 300,
        "discount_per_item": 60,
        "final_price_per_item": 240,
        "total_discount": 120
      }
    ],
    "promotion_type": "PERCENT_OFF_ITEM",
    "expires_at": "2025-01-08T10:30:00Z"
  }
}
```

### Database Record Created
```sql
INSERT INTO promotion_evaluations (
  evaluation_id, user_id, promotion_id, original_total, 
  discounted_total, total_discount, status, expires_at
) VALUES (
  'eval_1736334000000_promo_15', '24', 15, 600.00, 
  480.00, 120.00, 'active', '2025-01-08T10:30:00Z'
);
```

---

## Step 2: Check Automatic Promotions

### Request
```bash
curl -X POST http://localhost:5600/v1/promotions/evaluate/automatic \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "24",
    "cart_items": [
      {
        "cart_record_id": "410",
        "product_id": "14",
        "quantity": 2,
        "price": 300,
        "category": "electronics",
        "name": "Gadget"
      }
    ],
    "context": {
      "channel": "web",
      "geo": "IN"
    },
    "current_total": 600
  }'
```

### Response
```json
{
  "success": true,
  "data": {
    "evaluations": [
      {
        "evaluation_id": "eval_1736334000001_promo_58",
        "promotion_id": 58,
        "promotion_name": "Free Shipping Over ₹500",
        "is_eligible": true,
        "total_discount": 30,
        "expires_at": "2025-01-08T10:30:00Z",
        "promotion_type": "FREE_SHIPPING",
        "shipping_info": {
          "original_shipping_cost": 30,
          "final_shipping_cost": 0,
          "shipping_discount": 30,
          "is_free_shipping": true
        }
      }
    ],
    "total_automatic_discount": 30,
    "cart_total_after_automatic": 570
  }
}
```

### Database Record Created
```sql
INSERT INTO promotion_evaluations (
  evaluation_id, user_id, promotion_id, original_total, 
  discounted_total, total_discount, status, expires_at
) VALUES (
  'eval_1736334000001_promo_58', '24', 58, 600.00, 
  570.00, 30.00, 'active', '2025-01-08T10:30:00Z'
);
```

---

## Step 3: Frontend State Management

### Frontend State
```javascript
const promotionState = {
  userAppliedCoupons: [
    {
      evaluation_id: "eval_1736334000000_promo_15",
      promotion_id: 15,
      promotion_name: "FLAT20",
      discount: 120,
      type: "PERCENT_OFF_ITEM"
    }
  ],
  automaticPromotions: [
    {
      evaluation_id: "eval_1736334000001_promo_58",
      promotion_id: 58,
      promotion_name: "Free Shipping Over ₹500",
      discount: 30,
      type: "FREE_SHIPPING"
    }
  ],
  allEvaluationIds: [
    "eval_1736334000000_promo_15",
    "eval_1736334000001_promo_58"
  ],
  totalDiscount: 150, // 120 + 30
  finalTotal: 450     // 600 - 150
};
```

---

## Step 4: Order Placement with Multiple Evaluations

### Request
```bash
curl -X POST http://localhost:5600/v1/phonepe/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "phonepe",
    "evaluation_ids": [
      "eval_1736334000000_promo_15",
      "eval_1736334000001_promo_58"
    ],
    "transaction": {
      "userId": "24",
      "amount": 450,
      "currency": "INR"
    }
  }'
```

### Backend Processing
1. **Validation Phase**: Check both evaluation IDs
   - ✅ `eval_1736334000000_promo_15` - Valid, not expired
   - ✅ `eval_1736334000001_promo_58` - Valid, not expired

2. **Order Creation**: Create order with total ₹450

3. **Redemption Phase**: Attempt to redeem both promotions
   - ✅ FLAT20 (ID: 15) - Redeemed successfully
   - ✅ Free Shipping (ID: 58) - Redeemed successfully

### Response
```json
{
  "success": true,
  "data": {
    "order_id": "ORD_12345",
    "total_amount": 450,
    "promotion_redemptions": [
      {
        "evaluation_id": "eval_1736334000000_promo_15",
        "promotion_id": 15,
        "status": "success",
        "discount_applied": 120
      },
      {
        "evaluation_id": "eval_1736334000001_promo_58",
        "promotion_id": 58,
        "status": "success",
        "discount_applied": 30
      }
    ],
    "total_discount": 150
  }
}
```

---

## Database Records After Order

### promotion_evaluations table
```sql
-- Two separate evaluation records
evaluation_id                    | user_id | promotion_id | original_total | discounted_total | total_discount | status
eval_1736334000000_promo_15     | 24      | 15          | 600.00        | 480.00          | 120.00        | redeemed
eval_1736334000001_promo_58     | 24      | 58          | 600.00        | 570.00          | 30.00         | redeemed
```

### promotion_redemptions table
```sql
-- Two separate redemption records
id                              | evaluation_id                    | promotion_id | order_id | redeemed_at
redemption_123                  | eval_1736334000000_promo_15     | 15          | ORD_12345| 2025-01-08T10:15:00Z
redemption_124                  | eval_1736334000001_promo_58     | 58          | ORD_12345| 2025-01-08T10:15:00Z
```

---

## Benefits of This Approach

### 1. **Granular Control**
- Each promotion is evaluated and redeemed independently
- Partial failures don't affect other promotions
- Clear audit trail for each promotion

### 2. **Frontend Flexibility**
- Easy to show/hide individual promotions
- Simple to remove specific coupons
- Clear discount breakdown per promotion

### 3. **Backend Reliability**
- Individual validation per promotion
- Atomic redemption per promotion
- Better error handling and logging

### 4. **Database Efficiency**
- Indexed queries by promotion_id
- Easy to find all evaluations for a user
- Simple to clean up expired evaluations

---

## Error Scenarios

### Scenario 1: One Promotion Fails During Redemption
```json
{
  "success": true,
  "data": {
    "order_id": "ORD_12345",
    "total_amount": 480, // Order still created
    "promotion_redemptions": [
      {
        "evaluation_id": "eval_1736334000000_promo_15",
        "promotion_id": 15,
        "status": "success",
        "discount_applied": 120
      },
      {
        "evaluation_id": "eval_1736334000001_promo_58",
        "promotion_id": 58,
        "status": "failed",
        "reason": "Promotion limit reached"
      }
    ],
    "total_discount": 120
  }
}
```

### Scenario 2: Evaluation Expired Before Order
```json
{
  "success": false,
  "message": "Evaluation eval_1736334000000_promo_15 has expired",
  "error_code": "EVALUATION_INVALID",
  "action_required": "reapply_coupon"
}
```

This approach provides maximum flexibility and reliability for handling multiple promotions in a single order.
