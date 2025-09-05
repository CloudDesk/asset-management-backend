# Order Flow Examples with Promotion Handling

## 🎯 User Experience Scenarios

### **Scenario 1: Expired Evaluation**
**User Flow:**
1. User applies coupon → Evaluation created
2. User waits 16 minutes (expires)
3. User clicks "Place Order"

**Order API Response:**
```json
{
  "success": false,
  "message": "Promotion evaluation expired",
  "details": "Please re-apply the coupon to continue",
  "error_code": "EVALUATION_EXPIRED",
  "action_required": "reapply_coupon"
}
```

**UI Action:**
- Show message: "Your coupon has expired. Please re-apply it."
- Disable "Place Order" button
- Show "Re-apply Coupon" button

---

### **Scenario 2: Promotion Limits Reached**
**User Flow:**
1. User applies coupon → Evaluation created
2. Promotion budget exhausted between evaluation and order
3. User clicks "Place Order"

**Order API Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "order_12345",
    "status": "confirmed",
    "total_amount": 159.00,
    "discount_applied": 0.00,
    "promotion_status": "failed",
    "promotion_details": {
      "evaluation_id": "eval_123",
      "promotion_name": "Diwali Free Shipping",
      "failure_reason": "Promotion budget has been exhausted",
      "original_discount": 50.00
    },
    "warnings": [
      "Promotion no longer available. Order placed at full price."
    ]
  }
}
```

**UI Action:**
- Show success message: "Order placed successfully!"
- Show warning: "Promotion no longer available. You paid full price (₹159)"
- Option: "Try different promotion" or "Continue"

---

## 🛠️ Implementation Examples

### **1. Order Creation with Evaluation Check**

```typescript
// POST /v1/orders
async createOrder(request: {
  user_id: string;
  evaluation_id?: string;
  cart_items: any[];
  payment_details: any;
}) {
  // Step 1: Validate evaluation if provided
  if (request.evaluation_id) {
    const validation = await evaluationService.validateEvaluationForOrder(
      request.evaluation_id, 
      request.user_id
    );
    
    if (!validation.isValid) {
      return {
        success: false,
        message: validation.reason,
        error_code: "EVALUATION_INVALID",
        action_required: "reapply_coupon"
      };
    }
  }
  
  // Step 2: Create order
  const order = await this.createOrderRecord(request);
  
  // Step 3: Try to redeem promotion
  if (request.evaluation_id) {
    try {
      await redemptionService.redeemPromotion({
        evaluation_id: request.evaluation_id,
        order_id: order.id,
        user_id: request.user_id
      });
      
      // Success: Update order with discount
      await this.updateOrderWithDiscount(order.id, validation.evaluation);
      
    } catch (error) {
      // Failure: Order created without discount
      await this.updateOrderWithPromotionFailure(order.id, error.message);
    }
  }
  
  return { success: true, data: order };
}
```

### **2. Frontend Error Handling**

```typescript
// Frontend order placement
async function placeOrder(orderData, evaluationId) {
  try {
    const response = await fetch('/v1/orders', {
      method: 'POST',
      body: JSON.stringify({
        ...orderData,
        evaluation_id: evaluationId
      })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      // Handle evaluation errors
      if (result.error_code === 'EVALUATION_EXPIRED') {
        showMessage('Coupon expired. Please re-apply it.');
        disablePlaceOrderButton();
        showReapplyCouponButton();
        return;
      }
      
      if (result.error_code === 'EVALUATION_INVALID') {
        showMessage('Invalid coupon. Please try again.');
        clearCouponFromUI();
        return;
      }
    }
    
    // Handle promotion failures
    if (result.data.promotion_status === 'failed') {
      showSuccessMessage('Order placed successfully!');
      showWarningMessage(result.data.warnings[0]);
      showAlternativePromotions();
    } else {
      showSuccessMessage('Order placed with discount!');
    }
    
  } catch (error) {
    showErrorMessage('Order failed. Please try again.');
  }
}
```

### **3. User Decision Flow**

```typescript
// User choice handling
function handlePromotionFailure(order, promotionFailure) {
  const options = [
    {
      text: "Continue with full price",
      action: () => confirmOrder(order),
      style: "primary"
    },
    {
      text: "Try different promotion", 
      action: () => showAvailablePromotions(),
      style: "secondary"
    },
    {
      text: "Cancel order",
      action: () => cancelOrder(order),
      style: "danger"
    }
  ];
  
  showModal({
    title: "Promotion No Longer Available",
    message: `The ${promotionFailure.promotion_name} promotion is no longer available.`,
    details: promotionFailure.failure_reason,
    options: options
  });
}
```

## 📊 Database Status Tracking

### **Evaluation Statuses:**
- `'active'` - Ready for redemption
- `'expired'` - Time expired (15 min)
- `'cancelled'` - User removed
- `'redeemed'` - Successfully redeemed
- `'failed'` - Redemption failed

### **Order Statuses:**
- `'pending_payment'` - Order created, payment pending
- `'confirmed'` - Payment successful, promotions applied
- `'promotion_failed'` - Order created but promotion failed
- `'cancelled'` - Order cancelled

### **Redemption Statuses:**
- `'success'` - Promotion successfully redeemed
- `'budget_exhausted'` - Budget limit reached
- `'limit_exceeded'` - User/per-user limit reached
- `'promotion_inactive'` - Promotion deactivated

## 🔄 Complete User Journey

### **Happy Path:**
1. Apply coupon → Evaluation created
2. Place order → Promotion redeemed
3. Order confirmed with discount

### **Expired Path:**
1. Apply coupon → Evaluation created
2. Wait 16 minutes → Evaluation expires
3. Place order → Rejected with "expired" message
4. Re-apply coupon → New evaluation
5. Place order → Success

### **Limit Reached Path:**
1. Apply coupon → Evaluation created
2. Place order → Budget exhausted
3. Order created without discount
4. User chooses: Continue or try different promotion

This approach ensures:
- ✅ Orders are never lost due to promotion issues
- ✅ Users get clear feedback about promotion status
- ✅ System maintains data integrity
- ✅ Business rules are enforced
- ✅ User has control over their decisions
