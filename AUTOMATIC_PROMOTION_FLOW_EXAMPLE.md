# 🚀 Automatic Promotion Flow - Complete Example

## **📋 Scenario: User Applies FLAT20 + Gets Free Shipping**

**Cart:** ₹800 worth of products  
**User Action:** Applies FLAT20 coupon  
**System Action:** Automatically applies free shipping (since ₹800 - ₹20 = ₹780 ≥ ₹500)

---

## **🔄 Complete Flow**

### **Step 1: User Applies FLAT20 Coupon**

```bash
# Frontend calls evaluate for user-applied coupon
curl -X POST http://localhost:5600/v1/promotions/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "24",
    "promotion_id": 3,
    "cart_items": [
      {
        "cart_record_id": "410",
        "product_id": "14",
        "quantity": 1,
        "price": 800,
        "category": "wellness",
        "subcategory": "supplements",
        "name": "Wellness Product"
      }
    ],
    "context": {
      "channel": "web",
      "geo": "IN"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "evaluation_id": "eval_user_flat20_123",
    "promotion_id": 3,
    "promotion_name": "Flat ₹20 Off",
    "is_eligible": true,
    "original_total": 800,
    "discounted_total": 780,
    "total_discount": 20,
    "discount_breakdown": [
      {
        "cart_record_id": "410",
        "product_id": "14",
        "product_name": "Wellness Product",
        "category": "wellness",
        "quantity": 1,
        "original_price": 800,
        "discount_per_item": 20,
        "final_price_per_item": 780,
        "total_discount": 20
      }
    ],
    "expires_at": "2024-01-15T10:30:00Z"
  }
}
```

### **Step 2: Check for Automatic Promotions**

```bash
# Frontend calls evaluate automatic promotions with discounted total
curl -X POST http://localhost:5600/v1/promotions/evaluate/automatic \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "24",
    "cart_items": [
      {
        "cart_record_id": "410",
        "product_id": "14",
        "quantity": 1,
        "price": 800,
        "category": "wellness",
        "subcategory": "supplements",
        "name": "Wellness Product"
      }
    ],
    "context": {
      "channel": "web",
      "geo": "IN"
    },
    "current_total": 780
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "evaluations": [
      {
        "evaluation_id": "eval_auto_freeshipping_456",
        "promotion_id": 1,
        "promotion_name": "Free Shipping Over ₹500",
        "is_eligible": true,
        "total_discount": 50,
        "expires_at": "2024-01-15T10:30:00Z"
      }
    ],
    "total_automatic_discount": 50,
    "cart_total_after_automatic": 730
  }
}
```

### **Step 3: Place Order with Both Evaluations**

```bash
# Frontend sends both evaluation IDs to PhonePe
curl -X POST http://localhost:5600/v1/phonepe/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "cod",
    "evaluation_ids": [
      "eval_user_flat20_123",
      "eval_auto_freeshipping_456"
    ],
    "order": [
      {
        "addressid": 1,
        "cartId": 410,
        "discountamount": 70,
        "orderamount": 730,
        "productamount": 800,
        "productcategory": "wellness",
        "productid": 14,
        "productname": "Wellness Product",
        "quantity": 1,
        "userid": 24
      }
    ],
    "transaction": {
      "amount": 730,
      "mobilenumber": "9876543210",
      "name": "Test User",
      "productid": [14],
      "transactionfor": "product",
      "userId": 24
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "COD order created successfully",
  "data": {
    "merchantTransactionId": "TXN_1757061870796_abc123",
    "redirectUrl": "",
    "amount": 730,
    "status": "COD_ORDER_CREATED",
    "promotions_applied": [
      {
        "evaluation_id": "eval_user_flat20_123",
        "promotion_name": "Flat ₹20 Off",
        "discount_amount": 20,
        "status": "success"
      },
      {
        "evaluation_id": "eval_auto_freeshipping_456",
        "promotion_name": "Free Shipping Over ₹500",
        "discount_amount": 50,
        "status": "success"
      }
    ]
  }
}
```

---

## **🎯 Key Benefits of This Approach**

### **1. ✅ Automatic Detection**
- System automatically detects when cart total ≥ ₹500
- No user action required for free shipping
- Seamless user experience

### **2. ✅ Stackable Promotions**
- User coupons + automatic promotions work together
- FLAT20 (₹20 off) + Free Shipping (₹50 off) = ₹70 total discount
- Clear breakdown of each promotion

### **3. ✅ Immutable Evaluations**
- Each promotion gets its own `evaluation_id`
- Prevents double-redemption
- Atomic redemption process

### **4. ✅ Graceful Degradation**
- If automatic promotion fails (budget exhausted), order still succeeds
- User gets FLAT20 discount even if free shipping fails
- Clear feedback on which promotions applied/failed

---

## **📊 Database Records Created**

### **Promotion Evaluations Table:**
```sql
-- User-applied promotion evaluation
INSERT INTO promotion_evaluations (
  evaluation_id, user_id, original_total, discounted_total, 
  applied_promotions, context, expires_at, status
) VALUES (
  'eval_user_flat20_123', '24', 800, 780,
  '[{"promotion_id": 3, "discount": 20}]',
  '{"channel": "web", "geo": "IN"}',
  '2024-01-15T10:30:00Z', 'active'
);

-- Automatic promotion evaluation
INSERT INTO promotion_evaluations (
  evaluation_id, user_id, original_total, discounted_total,
  applied_promotions, context, expires_at, status
) VALUES (
  'eval_auto_freeshipping_456', '24', 780, 730,
  '[{"promotion_id": 1, "discount": 50}]',
  '{"channel": "web", "geo": "IN"}',
  '2024-01-15T10:30:00Z', 'active'
);
```

### **Promotion Redemptions Table:**
```sql
-- User coupon redemption
INSERT INTO promotion_redemptions (
  id, evaluation_id, order_id, user_id, promotion_id, discount_amount
) VALUES (
  'redemption_1', 'eval_user_flat20_123', 'ORDER_123', '24', 3, 20
);

-- Free shipping redemption
INSERT INTO promotion_redemptions (
  id, evaluation_id, order_id, user_id, promotion_id, discount_amount
) VALUES (
  'redemption_2', 'eval_auto_freeshipping_456', 'ORDER_123', '24', 1, 50
);
```

---

## **🔧 Frontend Implementation**

### **JavaScript Example:**
```javascript
class PromotionManager {
  async applyUserCoupon(couponCode, cartItems) {
    // 1. Evaluate user-applied coupon
    const userCouponEvaluation = await this.evaluatePromotion({
      code: couponCode,
      cart_items: cartItems,
      context: { channel: 'web', geo: 'IN' }
    });

    // 2. Calculate new total after user coupon
    const newTotal = this.calculateTotal(cartItems) - userCouponEvaluation.total_discount;

    // 3. Check for automatic promotions
    const automaticEvaluations = await this.evaluateAutomaticPromotions({
      cart_items: cartItems,
      current_total: newTotal,
      context: { channel: 'web', geo: 'IN' }
    });

    // 4. Combine all evaluations
    const allEvaluations = [
      userCouponEvaluation.evaluation_id,
      ...automaticEvaluations.evaluations.map(e => e.evaluation_id)
    ];

    // 5. Show user the final total
    this.updateCartDisplay({
      originalTotal: this.calculateTotal(cartItems),
      userCouponDiscount: userCouponEvaluation.total_discount,
      automaticDiscount: automaticEvaluations.total_automatic_discount,
      finalTotal: newTotal - automaticEvaluations.total_automatic_discount,
      appliedPromotions: [
        { name: 'FLAT20', discount: userCouponEvaluation.total_discount },
        ...automaticEvaluations.evaluations.map(e => ({
          name: e.promotion_name,
          discount: e.total_discount
        }))
      ]
    });

    return allEvaluations;
  }

  async placeOrder(evaluationIds, orderData) {
    // Send to PhonePe with all evaluation IDs
    return await this.initiatePayment({
      mode: 'cod',
      evaluation_ids: evaluationIds,
      order: orderData.order,
      transaction: orderData.transaction
    });
  }
}
```

---

## **🎨 UI Display Examples**

### **Cart Page Display:**
```
Cart Total: ₹800
├── FLAT20 Applied: -₹20
├── Free Shipping Applied: -₹50
└── Final Total: ₹730

Applied Promotions:
✅ FLAT20 - ₹20 off
✅ Free Shipping Over ₹500 - ₹50 off
```

### **Checkout Page Display:**
```
Order Summary:
Subtotal: ₹800
Discounts:
  • FLAT20: -₹20
  • Free Shipping: -₹50
Total Discount: -₹70
Final Amount: ₹730
```

---

## **🚨 Edge Cases Handled**

### **1. Promotion Budget Exhausted**
```json
{
  "success": true,
  "message": "COD order created successfully",
  "data": {
    "promotions_applied": [
      {
        "evaluation_id": "eval_user_flat20_123",
        "promotion_name": "Flat ₹20 Off",
        "discount_amount": 20,
        "status": "success"
      },
      {
        "evaluation_id": "eval_auto_freeshipping_456",
        "promotion_name": "Free Shipping Over ₹500",
        "discount_amount": 0,
        "status": "failed",
        "reason": "Promotion budget exhausted"
      }
    ]
  }
}
```

### **2. Evaluation Expired**
```json
{
  "success": false,
  "message": "Evaluation expired",
  "error_code": "EVALUATION_INVALID",
  "action_required": "reapply_coupon"
}
```

---

## **📈 Benefits Summary**

1. **🎯 User Experience**: Seamless automatic promotion application
2. **🔒 Data Integrity**: Immutable evaluations prevent fraud
3. **📊 Transparency**: Clear breakdown of all discounts
4. **🚀 Performance**: Efficient evaluation and redemption process
5. **🛡️ Reliability**: Graceful handling of failures
6. **📱 Scalability**: Supports multiple promotions simultaneously

This implementation perfectly handles your scenario where users apply coupons AND automatic promotions (like free shipping) are applied by the system! 🚀
